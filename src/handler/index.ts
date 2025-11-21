/* eslint-disable max-depth */
/* eslint-disable max-statements */

import { httpStatus } from '@nivalis/std';
import { NextRequest, NextResponse } from 'next/server';
import qs from 'qs';
import { DEFAULT_ERRORS } from '../errors';
import { parseContentType } from '../lib/content-type';
import { getPathsFromRoute } from '../lib/openapi';
import { openapiFailure } from '../lib/response';
import { validateSchema } from '../lib/zod';
import type { HttpStatusError } from '@nivalis/std/http-status';
import type z from 'zod';
import type { HttpMethod } from '../lib/http';
import type { ToJsonOptions } from '../lib/zod';
import type { BaseContentType } from '../types/content-type';
import type { OpenApiOperation, OpenApiPathItem } from '../types/open-api';
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
    outputs?: ReadonlyArray<OutputObject>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // biome-ignore lint/suspicious/noExplicitAny: Generic typing is handled downstream
    action: TypedRouteAction<any, any, any, any, any, any>;
  }) => {
    const createErrorResponse = <StatusCode extends HttpStatusError>({
      message,
      statusCode,
      error,
      headers,
    }: {
      message: string;
      statusCode: StatusCode;
      error?: unknown;
      headers?: Record<string, string | undefined>;
    }) =>
      NextResponse.json(
        openapiFailure({
          message,
          error,
          statusCode: statusCode as StatusCode,
        }),
        { status: statusCode, headers },
      );

    type ActionContextResult =
      | { context: ActionContext<unknown, BaseQuery, BaseParams> }
      | { response: NextResponse };

    type ValidationResult<T> = { data?: T; response?: NextResponse };

    const ensureContentType = (
      expected: string | undefined,
      actual: string | undefined | null,
    ) => {
      if (expected && actual !== expected) {
        return createErrorResponse({
          message: DEFAULT_ERRORS.unsupportedMediaType,
          statusCode: httpStatus.unsupportedMediaType,
          headers: {
            Allow: expected,
            'Not-Allowed': actual ?? 'unknown',
          },
        });
      }

      return null;
    };

    const validateBodySchema = async (
      bodySchema: z.ZodType | undefined,
      parseJsonBody: () => Promise<unknown>,
    ): Promise<ValidationResult<unknown>> => {
      if (!bodySchema) {
        return {};
      }

      try {
        const json = await parseJsonBody();

        const { valid, errors, data } = validateSchema({
          schema: bodySchema,
          obj: json,
        });

        if (!valid) {
          return {
            response: createErrorResponse({
              message: DEFAULT_ERRORS.invalidRequestBody,
              statusCode: httpStatus.badRequest,
              error: errors,
            }),
          };
        }

        return { data };
      } catch {
        return {
          response: createErrorResponse({
            message: `${DEFAULT_ERRORS.invalidRequestBody} Failed to parse JSON body.`,
            statusCode: httpStatus.badRequest,
          }),
        };
      }
    };

    const validateQuerySchema = (
      querySchema: z.ZodType | undefined,
      reqClone: NextRequest,
    ): ValidationResult<BaseQuery> => {
      if (!querySchema) {
        return {};
      }

      const { valid, errors, data } = validateSchema({
        schema: querySchema,
        obj: qs.parse(reqClone.nextUrl.search, {
          ignoreQueryPrefix: true,
        }),
      });

      if (!valid) {
        return {
          response: createErrorResponse({
            message: DEFAULT_ERRORS.invalidQueryParameters,
            statusCode: httpStatus.badRequest,
            error: errors,
          }),
        };
      }

      return { data: data as BaseQuery };
    };

    const validateParamsSchema = async (
      paramsSchema: z.ZodType | undefined,
      paramsPromise: Promise<BaseParams>,
    ): Promise<ValidationResult<BaseParams>> => {
      if (!paramsSchema) {
        return {};
      }

      const { valid, errors, data } = validateSchema({
        schema: paramsSchema,
        obj: await paramsPromise,
      });

      if (!valid) {
        return {
          response: createErrorResponse({
            message: DEFAULT_ERRORS.invalidPathParameters,
            statusCode: httpStatus.badRequest,
            error: errors,
          }),
        };
      }

      return { data: data as BaseParams };
    };
    const buildActionContext = async (
      reqClone: NextRequest,
      paramsPromise: Promise<BaseParams>,
      parseJsonBody: () => Promise<unknown>,
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Input validation requires multiple guarded branches
    ): Promise<ActionContextResult> => {
      const actionContext: ActionContext<unknown, BaseQuery, BaseParams> = {
        body: undefined as unknown,
        query: undefined as unknown as BaseQuery,
        params: undefined as unknown as BaseParams,
      };

      const { input } = operation;

      if (!input) {
        return { context: actionContext };
      }

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

      const contentTypeError = ensureContentType(
        contentTypeSchema,
        contentType,
      );

      if (contentTypeError) {
        return { response: contentTypeError };
      }

      if (bodySchema && contentType === 'application/json') {
        const bodyResult = await validateBodySchema(bodySchema, parseJsonBody);

        if (bodyResult.response) {
          return { response: bodyResult.response };
        }

        if (bodyResult.data !== undefined) {
          actionContext.body = bodyResult.data;
        }
      }

      const queryResult = validateQuerySchema(querySchema, reqClone);

      if (queryResult.response) {
        return { response: queryResult.response };
      }

      if (queryResult.data) {
        actionContext.query = queryResult.data;
      }

      const paramsResult = await validateParamsSchema(
        paramsSchema,
        paramsPromise,
      );

      if (paramsResult.response) {
        return { response: paramsResult.response };
      }

      if (paramsResult.data) {
        actionContext.params = paramsResult.data;
      }

      return { context: actionContext };
    };

    const reqHandler = async (
      req_: NextRequest,
      context: { params: Promise<BaseParams> },
    ) => {
      try {
        if (req_.method !== method) {
          return createErrorResponse({
            message: DEFAULT_ERRORS.methodNotAllowed,
            statusCode: httpStatus.methodNotAllowed,
          });
        }

        const { action } = operation;

        const _reqClone = req_.clone() as NextRequest;

        const reqClone = new NextRequest(_reqClone.url, {
          method: _reqClone.method,
          headers: _reqClone.headers,
        });

        const parseJsonBody = async () => await req_.clone().json();

        const actionContextResult = await buildActionContext(
          reqClone,
          context.params,
          parseJsonBody,
        );

        if ('response' in actionContextResult) {
          return actionContextResult.response;
        }

        const res = await action?.(
          actionContextResult.context as ActionContext,
          {},
        );

        if (!res) {
          return createErrorResponse({
            message: DEFAULT_ERRORS.notImplemented,
            statusCode: httpStatus.notImplemented,
          });
        }

        return res;
      } catch (error) {
        errorHandler(error);

        return createErrorResponse({
          message: DEFAULT_ERRORS.internalServerError,
          statusCode: httpStatus.internalServerError,
          error,
        });
      }
    };

    reqHandler._generateOpenApi = (
      routeName: string,
      zodToJsonOptions?: ToJsonOptions,
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

    input<I extends InputObject>(input: I) {
      type Body = z.infer<NonNullable<I['body']>>;
      type Query = z.infer<NonNullable<I['query']>>;
      type Params = z.infer<NonNullable<I['params']>>;
      type ContentType = I['contentType'] extends BaseContentType
        ? I['contentType']
        : BaseContentType;

      return {
        action: (
          handler: TypedRouteAction<Method, ContentType, Body, Query, Params>,
        ) => createActionOperation({ input, action: handler }),

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
      };
    },
  };
};
