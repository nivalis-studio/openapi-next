/* eslint-disable max-depth */
/* eslint-disable max-statements */
import { NextRequest, NextResponse } from 'next/server';
import qs from 'qs';
import { DEFAULT_ERRORS } from '../errors';
import { validateSchema } from '../lib/zod';
import { getPathsFromRoute } from '../lib/openapi';
import { parseContentType } from '../lib/content-type';
import type { HttpMethod } from '../lib/http';
import type { OpenApiOperation, OpenApiPathItem } from '../types/open-api';
import type { BaseContentType } from '../types/content-type';
import type {
  ActionContext,
  BaseOptions,
  BaseParams,
  BaseQuery,
  BaseStatus,
  InputObject,
  OutputObject,
  TypedRouteAction,
} from '../types/operation';
import type { Options } from 'zod-to-json-schema';

type RouteHandlerOptions<Method extends HttpMethod> = {
  method: Method;
  operationId: string;
  errorHandler?: (error: unknown) => void;
  openApiPath?: OpenApiPathItem;
  openApiOperation?: OpenApiOperation;
};

const DEFAULT_ERROR_HANDLER = (error: unknown) => {
  console.error(error);
};

/**
 * Creates a strongly-typed Next.js route handler with built-in request validation and OpenAPI spec generation.
 * This function provides automatic request validation, response type checking, and OpenAPI documentation generation.
 * @param {object} options - Configuration options for the route handler
 * @param {string} options.method - The HTTP method this route handles
 * @param {string} options.operationId - A unique identifier for this operation
 * @param {Function} [options.errorHandler] - Custom error handler function
 * @param {object} [options.openApiPath] - OpenAPI path item object for additional documentation
 * @param {object} [options.openApiOperation] - OpenAPI operation object for additional documentation
 * @returns {Function} A Next.js route handler with type safety and request validation
 */
export const routeHandler = <Method extends HttpMethod>({
  method,
  operationId,
  errorHandler = DEFAULT_ERROR_HANDLER,
  ...options
}: RouteHandlerOptions<Method>) => {
  const createActionOperation = (operation: {
    input?: InputObject;
    outputs?: readonly OutputObject[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: TypedRouteAction<any, any, any, any, any, any>;
  }) => {
    const reqHandler = async (
      req_: NextRequest,
      context: { params: Promise<BaseParams> },
    ) => {
      try {
        if (req_.method !== method) {
          return NextResponse.json(
            { message: DEFAULT_ERRORS.methodNotAllowed },
            { status: 405 },
          );
        }

        const { input, action } = operation;

        const _reqClone = req_.clone() as NextRequest;

        const reqClone = new NextRequest(_reqClone.url, {
          method: _reqClone.method,
          headers: _reqClone.headers,
        });

        reqClone.json = async () => await req_.clone().json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actionContext: ActionContext<Body, any, any> = {
          body: undefined as unknown as Body,
          query: undefined as unknown,
          params: undefined as unknown,
        };

        if (input) {
          const {
            body: bodySchema,
            query: querySchema,
            contentType: contentTypeSchema,
            params: paramsSchema,
          } = input;

          const parsedContentType = parseContentType(
            reqClone.headers.get('content-type'),
          );
          const contentType = parsedContentType?.type;

          if (contentTypeSchema && contentType !== contentTypeSchema) {
            return NextResponse.json(
              { message: DEFAULT_ERRORS.invalidMediaType },
              {
                status: 415,
                headers: {
                  Allow: contentTypeSchema,
                  'Not-Allowed': contentType,
                },
              },
            );
          }

          if (bodySchema && contentType === 'application/json') {
            try {
              const json = await reqClone.json();

              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const { valid, errors, data } = validateSchema({
                schema: bodySchema,
                obj: json,
              });

              if (!valid) {
                return NextResponse.json(
                  {
                    message: DEFAULT_ERRORS.invalidRequestBody,
                    errors,
                  },
                  { status: 400 },
                );
              }

              actionContext.body = data as Body;
            } catch {
              return NextResponse.json(
                {
                  message: `${DEFAULT_ERRORS.invalidRequestBody} Failed to parse JSON body.`,
                },
                { status: 400 },
              );
            }
          }

          if (querySchema) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const { valid, errors, data } = validateSchema({
              schema: querySchema,
              obj: qs.parse(reqClone.nextUrl.search, {
                ignoreQueryPrefix: true,
              }),
            });

            if (!valid) {
              return NextResponse.json(
                {
                  message: DEFAULT_ERRORS.invalidQueryParameters,
                  errors,
                },
                { status: 400 },
              );
            }

            actionContext.query = data;
          }

          if (paramsSchema) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const { valid, errors, data } = validateSchema({
              schema: paramsSchema,
              obj: await context.params,
            });

            if (!valid) {
              return NextResponse.json(
                {
                  message: DEFAULT_ERRORS.invalidPathParameters,
                  errors,
                },
                { status: 400 },
              );
            }

            actionContext.params = data;
          }
        }

        const res = await action?.(actionContext, {});

        if (!res) {
          return NextResponse.json(
            { message: DEFAULT_ERRORS.notImplemented },
            { status: 501 },
          );
        }

        return res;
      } catch (error) {
        errorHandler(error);

        return NextResponse.json(
          { message: DEFAULT_ERRORS.unexpectedError },
          { status: 500 },
        );
      }
    };

    reqHandler._generateOpenApi = (
      routeName: string,
      zodToJsonOptions?: Partial<Options<'openApi3'>>,
    ) =>
      getPathsFromRoute({
        method,
        routeName,
        operation,
        operationId,
        openApiPath: options?.openApiPath,
        openApiOperation: options?.openApiOperation,
        zodToJsonOptions,
      });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      [method]: reqHandler,
    } as { [key in Method]: typeof reqHandler };
  };

  return {
    action: (action: TypedRouteAction) => createActionOperation({ action }),

    outputs: <
      ResponseBody extends BaseOptions,
      Status extends BaseStatus,
      ResponseContentType extends BaseContentType,
      Outputs extends ReadonlyArray<
        OutputObject<ResponseBody, Status, ResponseContentType>
      >,
    >(
      outputs: Outputs,
    ) => ({
      action: (
        action: TypedRouteAction<
          Method,
          BaseContentType,
          unknown,
          BaseQuery,
          BaseParams,
          BaseOptions,
          ResponseBody,
          Status,
          ResponseContentType,
          Outputs
        >,
      ) => createActionOperation({ outputs, action }),
    }),

    input: <
      ContentType extends BaseContentType,
      Body,
      Query extends BaseQuery,
      Params extends BaseParams,
    >(
      input: InputObject<ContentType, Body, Query, Params>,
    ) => ({
      action: (
        action: TypedRouteAction<Method, ContentType, Body, Query, Params>,
      ) => createActionOperation({ input, action }),

      outputs: <
        ResponseBody extends BaseOptions,
        Status extends BaseStatus,
        ResponseContentType extends BaseContentType,
        Outputs extends ReadonlyArray<
          OutputObject<ResponseBody, Status, ResponseContentType>
        >,
      >(
        outputs: Outputs,
      ) => ({
        action: (
          action: TypedRouteAction<
            Method,
            ContentType,
            Body,
            Query,
            Params,
            BaseOptions,
            ResponseBody,
            Status,
            ResponseContentType,
            Outputs
          >,
        ) => createActionOperation({ input, outputs, action }),
      }),
    }),
  };
};
