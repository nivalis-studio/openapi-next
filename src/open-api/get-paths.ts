/* eslint-disable complexity */
/* eslint-disable max-statements */
import { merge } from 'es-toolkit/compat';
import { isValidMethod } from '@/utils/is-valid-method';
import {
  ERROR_MESSAGE_SCHEMA,
  INVALID_PATH_PARAMETERS_RESPONSE,
  INVALID_QUERY_PARAMETERS_RESPONSE,
  INVALID_REQUEST_BODY_RESPONSE,
  MESSAGE_WITH_ERRORS_SCHEMA,
  UNEXPECTED_ERROR_RESPONSE,
} from '@/open-api/constants';
import { capitalizeFirstLetter } from '@/utils/capitalize';
import { getJsonSchema } from '@/zod/schemas';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { ZodObject, ZodRawShape, ZodSchema } from 'zod';
import type { RouteOperationDefinition } from '@/types/operation';
import type { OpenApiPathItem } from '@/types/openapi';

const isSchemaRef = (
  schema: OpenAPI.SchemaObject | OpenAPI.ReferenceObject,
): schema is OpenAPI.ReferenceObject => '$ref' in schema;

export type NrfOasData = {
  paths?: OpenAPI.PathsObject;
  schemas?: { [key: string]: OpenAPI.SchemaObject };
};

// Get OpenAPI paths from a route or API route.
export const getPathsFromRoute = ({
  operations,
  options,
  route,
}: {
  operations: {
    [key: string]: RouteOperationDefinition;
  };
  options?: { openApiPath?: OpenApiPathItem };
  route: string;
}): NrfOasData => {
  const paths: OpenAPI.PathsObject = {};

  paths[route] = {
    ...options?.openApiPath,
  };

  const requestBodySchemas: {
    [key: string]: {
      key: string;
      ref: string;
      schema: OpenAPI.SchemaObject;
    };
  } = {};

  const responseBodySchemas: {
    [key: string]: Array<{
      key: string;
      ref: string;
      schema: OpenAPI.SchemaObject;
    }>;
  } = {};

  const baseResponseBodySchemaMapping: {
    [key: string]: OpenAPI.SchemaObject;
  } = {
    ErrorMessage: ERROR_MESSAGE_SCHEMA,
  };

  // eslint-disable-next-line unicorn/no-array-for-each
  Object.entries(operations).forEach(
    ([operationId, { openApiOperation, method: _method, input, outputs }]: [
      string,
      RouteOperationDefinition,
    ]) => {
      if (!isValidMethod(_method)) {
        return;
      }

      const method = _method?.toLowerCase();

      const generatedOperationObject: OpenAPI.OperationObject = {
        operationId,
      };

      if (input?.body && input?.contentType) {
        const key = `${capitalizeFirstLetter(operationId)}RequestBody`;

        const schema =
          input.bodySchema ??
          getJsonSchema({
            schema: input.body,
            operationId,
            type: 'input-body',
          });

        const ref = isSchemaRef(schema)
          ? schema.$ref
          : `#/components/schemas/${key}`;

        if (!isSchemaRef(schema)) {
          requestBodySchemas[method] = {
            key,
            ref,
            schema,
          };
        }

        generatedOperationObject.requestBody = {
          content: {
            [input.contentType]: {
              schema: {
                $ref: ref,
              },
            },
          },
        };

        const description =
          input.bodySchema?.description ?? input.body._def.description;

        if (description) {
          generatedOperationObject.requestBody.description = description;
        }
      }

      const usedStatusCodes: number[] = [];

      const baseOperationResponses: OpenAPI.ResponsesObject = {
        500: UNEXPECTED_ERROR_RESPONSE,
      };

      if (input?.bodySchema) {
        baseOperationResponses[400] = INVALID_REQUEST_BODY_RESPONSE;

        baseResponseBodySchemaMapping.MessageWithErrors =
          MESSAGE_WITH_ERRORS_SCHEMA;
      }

      if (input?.querySchema) {
        baseOperationResponses[400] = INVALID_QUERY_PARAMETERS_RESPONSE;

        baseResponseBodySchemaMapping.InvalidQueryParameters =
          MESSAGE_WITH_ERRORS_SCHEMA;
      }

      if (input?.paramsSchema) {
        baseOperationResponses[400] = INVALID_PATH_PARAMETERS_RESPONSE;

        baseResponseBodySchemaMapping.InvalidPathParameters =
          MESSAGE_WITH_ERRORS_SCHEMA;
      }

      generatedOperationObject.responses = outputs?.reduce(
        (obj, { status, contentType, body, bodySchema, name }) => {
          const occurrenceOfStatusCode = usedStatusCodes.includes(status)
            ? usedStatusCodes.filter(sts => sts === status).length + 1
            : '';

          const key =
            name ??
            `${capitalizeFirstLetter(
              operationId,
            )}${status}ResponseBody${occurrenceOfStatusCode}`;

          usedStatusCodes.push(status);

          const schema =
            bodySchema ??
            getJsonSchema({
              schema: body,
              operationId,
              type: 'output-body',
            });

          const ref = isSchemaRef(schema)
            ? schema.$ref
            : `#/components/schemas/${key}`;

          if (!isSchemaRef(schema)) {
            responseBodySchemas[method] = [
              ...(responseBodySchemas[method] ?? []),
              {
                key,
                ref,
                schema,
              },
            ];
          }

          const description =
            bodySchema?.description ??
            body._def.description ??
            `Response for status ${status}`;

          return Object.assign(obj, {
            [status]: {
              description,
              content: {
                [contentType]: {
                  schema: {
                    $ref: ref,
                  },
                },
              },
            },
          });
        },
        baseOperationResponses,
      );

      let pathParameters: OpenAPI.ParameterObject[] = [];

      if (input?.params) {
        const schema =
          input.paramsSchema ??
          getJsonSchema({
            schema: input.params,
            operationId,
            type: 'input-params',
          }).properties ??
          {};

        pathParameters = Object.entries(schema).map(([name, schema_]) => {
          const schema__ = (input.params as ZodObject<ZodRawShape>).shape[
            name
          ] as ZodSchema;

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return {
            name,
            in: 'path',
            required: !schema__.isOptional(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            schema: schema_,
          } as OpenAPI.ParameterObject;
        });

        generatedOperationObject.parameters = [
          ...(generatedOperationObject.parameters ?? []),
          ...pathParameters,
        ];
      }

      const automaticPathParameters = route
        // eslint-disable-next-line regexp/no-unused-capturing-group
        .match(/\{([^}]+)\}/g)
        ?.map(param => param.replaceAll(/[{}]/g, ''))
        // Filter out path parameters that have been explicitly defined.
        .filter(_name => !pathParameters?.some(({ name }) => name === _name));

      if (automaticPathParameters?.length) {
        generatedOperationObject.parameters = [
          ...(generatedOperationObject.parameters ?? []),
          ...(automaticPathParameters.map(name => ({
            name,
            in: 'path',
            required: true,
            schema: { type: 'string' },
          })) as OpenAPI.ParameterObject[]),
        ];
      }

      if (input?.query) {
        const schema =
          input.querySchema ??
          getJsonSchema({
            schema: input.query,
            operationId,
            type: 'input-query',
          }).properties ??
          {};

        generatedOperationObject.parameters = [
          ...(generatedOperationObject.parameters ?? []),
          ...Object.entries(schema).map(([name, schema_]) => {
            const schema__ = (input.query as ZodObject<ZodRawShape>).shape[
              name
            ] as ZodSchema;

            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            return {
              name,
              in: 'query',
              required: !schema__.isOptional(),
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              schema: schema_,
            } as OpenAPI.ParameterObject;
          }),
        ];
      }

      paths[route] = {
        ...paths[route],
        [method]: merge(generatedOperationObject, openApiOperation),
      };
    },
  );

  const requestBodySchemaMapping = Object.values(requestBodySchemas).reduce<{
    [key: string]: OpenAPI.SchemaObject;
  }>((acc, { key, schema }) => {
    // eslint-disable-next-line no-param-reassign
    acc[key] = schema;

    return acc;
  }, {});

  const responseBodySchemaMapping = Object.values(responseBodySchemas)
    .flat()
    .reduce<{ [key: string]: OpenAPI.SchemaObject }>((acc, { key, schema }) => {
      // eslint-disable-next-line no-param-reassign
      acc[key] = schema;

      return acc;
    }, baseResponseBodySchemaMapping);

  const schemas: { [key: string]: OpenAPI.SchemaObject } = {
    ...requestBodySchemaMapping,
    ...responseBodySchemaMapping,
  };

  return { paths, schemas };
};
