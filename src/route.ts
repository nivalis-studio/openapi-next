/* eslint-disable max-depth */
/* eslint-disable max-statements */
import { NextRequest, NextResponse } from 'next/server';
import qs from 'qs';
import { DEFAULT_ERRORS } from '@/errors/http-errors';
import { errorHandler } from '@/errors/handler';
import { getPathsFromRoute } from '@/open-api/get-paths';
import { validateSchema } from '@/zod/schemas';
import type {
  BaseParams,
  RouteOperationDefinition,
  TypedNextRequest,
} from '@/types/operation';
import type { OpenApiPathItem } from '@/types/openapi';

export const routeHandler = <
  T extends {
    [key: string]: RouteOperationDefinition;
  },
>(
  operations: {
    [key: string]: RouteOperationDefinition;
  },
  options?: {
    openApiPath?: OpenApiPathItem;
  },
) => {
  const handler = async (
    _req: NextRequest,
    context: { params: BaseParams },
  ) => {
    try {
      const operation = Object.entries(operations).find(
        ([_, ope]) => ope.method === _req.method,
      )?.[1];

      if (!operation) {
        return NextResponse.json(
          { message: DEFAULT_ERRORS.methodNotAllowed },
          {
            status: 405,
            headers: {
              Allow: Object.values(operations)
                .map(({ method }) => method)
                .join(', '),
            },
          },
        );
      }

      const { input, handler: opHandler } = operation;

      const _reqClone = _req.clone() as NextRequest;

      let reqClone = new NextRequest(_reqClone.url, {
        method: _reqClone.method,
        headers: _reqClone.headers,
      });

      reqClone.json = async () => await _req.clone().json();

      if (input) {
        const {
          body: bodySchema,
          query: querySchema,
          contentType: contentTypeSchema,
          params: paramsSchema,
        } = input;

        const contentType = reqClone.headers.get('content-type')?.split(';')[0];

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
                {
                  status: 400,
                },
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
              {
                status: 400,
              },
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
              {
                status: 400,
              },
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
              {
                status: 400,
              },
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          context.params = data;
        }
      }

      const res = await opHandler?.(reqClone as TypedNextRequest, context, {});

      if (!res) {
        return NextResponse.json(
          { message: DEFAULT_ERRORS.notImplemented },
          { status: 501 },
        );
      }

      return res;
    } catch (error: unknown) {
      errorHandler(error);

      return NextResponse.json(
        { message: DEFAULT_ERRORS.unexpectedError },
        { status: 500 },
      );
    }
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  handler._getPathsForRoute = async (route: string) => {
    return getPathsFromRoute({
      operations,
      options,
      route,
    });
  };

  // Map all methods for app router.
  const api = Object.values(operations).reduce(
    (acc, operation) => {
      // eslint-disable-next-line no-param-reassign
      acc[operation.method as keyof typeof acc] = handler;

      return acc;
    },

    {} as { [key in T[keyof T]['method']]: typeof handler },
  ) as { [key in T[keyof T]['method']]: typeof handler };

  return api;
};
