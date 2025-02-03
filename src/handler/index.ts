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
  BaseOptions,
  BaseParams,
  BaseQuery,
  BaseStatus,
  InputObject,
  OutputObject,
  TypedNextRequest,
  TypedRouteHandler,
} from '../types/operation';

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

export const routeHandler = <Method extends HttpMethod>({
  method,
  operationId,
  errorHandler = DEFAULT_ERROR_HANDLER,
  ...options
}: RouteHandlerOptions<Method>) => {
  const createOperation = (operation: {
    input?: InputObject;
    outputs?: readonly OutputObject[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: TypedRouteHandler<any, any, any, any, any, any>;
  }) => {
    const reqHandler = async (
      req_: NextRequest,
      context: { params: BaseParams },
    ) => {
      try {
        if (req_.method !== method) {
          return NextResponse.json(
            { message: DEFAULT_ERRORS.methodNotAllowed },
            { status: 405 },
          );
        }

        const { input, handler } = operation;
        const _reqClone = req_.clone() as NextRequest;

        let reqClone = new NextRequest(_reqClone.url, {
          method: _reqClone.method,
          headers: _reqClone.headers,
        });

        reqClone.json = async () => await req_.clone().json();

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
              { status: 415, headers: { Allow: contentTypeSchema } },
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

              reqClone = new NextRequest(reqClone.url, {
                method: reqClone.method,
                headers: reqClone.headers,
                body: JSON.stringify(data),
              });

              // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return
              reqClone.json = async () => data;
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

            const url = new URL(reqClone.url);

            // Update the query parameters
            for (const [key, _value] of url.searchParams.entries()) {
              url.searchParams.delete(key);

              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              if (data[key]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                url.searchParams.append(key, data[key]);
              }
            }

            reqClone = new NextRequest(url, {
              method: reqClone.method,
              headers: reqClone.headers,
              body: reqClone.body,
            });
          }

          if (paramsSchema) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const { valid, errors, data } = validateSchema({
              schema: paramsSchema,
              obj: context.params,
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

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            context.params = data;
          }
        }

        const res = await handler?.(reqClone as TypedNextRequest, context, {});

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

    reqHandler._generateOpenApi = (routeName: string) =>
      getPathsFromRoute({
        method,
        routeName,
        operation,
        operationId,
        openApiPath: options?.openApiPath,
        openApiOperation: options?.openApiOperation,
      });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      [method]: reqHandler,
    } as { [key in Method]: typeof reqHandler };
  };

  return {
    handler: (handler: TypedRouteHandler) => createOperation({ handler }),

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
      handler: (
        handler: TypedRouteHandler<
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
      ) => createOperation({ outputs, handler }),
    }),

    input: <
      ContentType extends BaseContentType,
      Body,
      Query extends BaseQuery,
      Params extends BaseParams,
    >(
      input: InputObject<ContentType, Body, Query, Params>,
    ) => ({
      handler: (
        handler: TypedRouteHandler<Method, ContentType, Body, Query, Params>,
      ) => createOperation({ input, handler }),

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
        handler: (
          handler: TypedRouteHandler<
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
        ) => createOperation({ input, outputs, handler }),
      }),
    }),
  };
};
