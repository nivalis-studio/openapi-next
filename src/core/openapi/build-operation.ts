import { toRequestJsonSchema, toResponseJsonSchema } from './json-schema';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { RouteDefinition } from '../contract';
import type { ZodToJsonOptions } from './json-schema';

type RequestParameterSchema = NonNullable<
  NonNullable<RouteDefinition['input']>['query']
>;

const getPathTemplateParameterNames = (routePath: string): Set<string> =>
  new Set(
    Array.from(routePath.matchAll(/\{([^}]+)\}/g), ([, parameterName]) =>
      parameterName?.trim(),
    ).filter((parameterName): parameterName is string =>
      Boolean(parameterName),
    ),
  );

const toParameters = ({
  schema,
  location,
  operationId,
  routePath,
  method,
  zodToJsonOptions,
}: {
  schema: RequestParameterSchema;
  location: 'query' | 'path';
  operationId: string;
  routePath: string;
  method: RouteDefinition['method'];
  zodToJsonOptions?: ZodToJsonOptions;
}): Array<OpenAPI.ParameterObject> => {
  const jsonSchema = toRequestJsonSchema(
    schema,
    {
      operationId,
      routePath,
      method,
      role: location === 'query' ? 'query' : 'params',
    },
    zodToJsonOptions,
  );
  const required = new Set(jsonSchema.required ?? []);
  const pathTemplateParameters =
    location === 'path' ? getPathTemplateParameterNames(routePath) : null;

  return Object.entries(jsonSchema.properties ?? {})
    .filter(([name]) =>
      location === 'path' ? pathTemplateParameters?.has(name) === true : true,
    )
    .map(
      ([name, value]) =>
        ({
          name,
          in: location,
          required: location === 'path' ? true : required.has(name),
          schema: value as OpenAPI.SchemaObject,
        }) as OpenAPI.ParameterObject,
    );
};

export const buildOperation = ({
  routePath,
  route,
  zodToJsonOptions,
}: {
  routePath: string;
  route: RouteDefinition;
  zodToJsonOptions?: ZodToJsonOptions;
}): OpenAPI.OperationObject => {
  const pathTemplateParameters = getPathTemplateParameterNames(routePath);
  const queryParameters =
    route.input?.query == null
      ? []
      : toParameters({
          schema: route.input.query,
          location: 'query',
          operationId: route.operationId,
          routePath,
          method: route.method,
          zodToJsonOptions,
        });
  const pathParameters =
    route.input?.params == null
      ? []
      : toParameters({
          schema: route.input.params,
          location: 'path',
          operationId: route.operationId,
          routePath,
          method: route.method,
          zodToJsonOptions,
        });

  if (pathTemplateParameters.size > 0) {
    const generatedPathParameterNames = new Set(
      pathParameters.map(parameter => parameter.name),
    );
    const missingTemplateParameters = [...pathTemplateParameters].filter(
      parameterName => !generatedPathParameterNames.has(parameterName),
    );

    if (missingTemplateParameters.length > 0) {
      throw new Error(
        `Templated route path parameters are missing from route.input.params | operationId: ${route.operationId} | routePath: ${routePath} | missingTemplateParams: ${missingTemplateParameters.join(', ')}`,
      );
    }
  }

  const parameters = [...queryParameters, ...pathParameters];

  const responses = Object.entries(
    route.responses,
  ).reduce<OpenAPI.ResponsesObject>((acc, [status, response]) => {
    const previous = (acc[status] ?? {
      description: response.description,
      content: {},
    }) as OpenAPI.ResponseObject;

    const content = Object.entries(response.content).reduce<
      Record<string, OpenAPI.MediaTypeObject>
    >((mediaAcc, [contentType, media]) => {
      mediaAcc[contentType] = {
        schema: toResponseJsonSchema(
          media.schema,
          {
            operationId: route.operationId,
            routePath,
            method: route.method,
            role: 'responseBody',
          },
          zodToJsonOptions,
        ) as OpenAPI.SchemaObject,
      };

      return mediaAcc;
    }, previous.content ?? {});

    acc[status] = {
      ...previous,
      description: previous.description || response.description,
      content,
    };

    return acc;
  }, {});

  return {
    operationId: route.operationId,
    ...(parameters.length === 0 ? {} : { parameters }),
    ...(route.input?.body == null
      ? {}
      : {
          requestBody: {
            required: !route.input.body.isOptional(),
            content: {
              [route.input.contentType ?? 'application/json']: {
                schema: toRequestJsonSchema(
                  route.input.body,
                  {
                    operationId: route.operationId,
                    routePath,
                    method: route.method,
                    role: 'requestBody',
                  },
                  zodToJsonOptions,
                ) as OpenAPI.SchemaObject,
              },
            },
          } as OpenAPI.RequestBodyObject,
        }),
    responses,
  };
};
