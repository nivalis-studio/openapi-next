import { Effect } from 'effect';
import {
  formatMethodNotAllowedMessage,
  formatUnsupportedMediaTypeMessage,
  HTTP_ERROR_MESSAGE,
  HTTP_STATUS,
} from '../../lib/http';
import { ERROR_CODES } from '../errors/error-codes';
import { isJsonMediaType, normalizeMediaType } from './media-type';
import type { NextRequest } from 'next/server';
import type { RouteDefinition } from '../contract';

type InputError = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

type InputSuccess = {
  params: unknown;
  query: unknown;
  body: unknown;
};

type InputValidationResult =
  | { ok: true; data: InputSuccess }
  | { ok: false; error: InputError };

type RouteInputConfig = RouteDefinition['input'];
type RouteBodySchema = NonNullable<RouteInputConfig>['body'];

const JSON_PARSE_ERROR = Symbol('json-parse-error');

const resolveParams = (
  paramsPromise: Promise<unknown>,
): Effect.Effect<unknown, InputError> =>
  Effect.tryPromise({
    try: () => paramsPromise,
    catch: error => ({
      status: HTTP_STATUS.badRequest,
      code: ERROR_CODES.invalidParams,
      message: HTTP_ERROR_MESSAGE.invalidPathParameters,
      details: error,
    }),
  });

const parseRequestBody = (
  request: NextRequest,
  mediaType: string,
): Effect.Effect<unknown | typeof JSON_PARSE_ERROR, never> =>
  Effect.tryPromise({
    try: () => request.clone().text(),
    catch: () => '',
  }).pipe(
    Effect.orDie,
    Effect.flatMap(rawBody => {
      if (rawBody.trim().length === 0) {
        return Effect.succeed(undefined);
      }

      if (isJsonMediaType(mediaType)) {
        return Effect.try({
          try: () => JSON.parse(rawBody),
          catch: () => JSON_PARSE_ERROR,
        }).pipe(
          Effect.match({
            onSuccess: value => value,
            onFailure: () => JSON_PARSE_ERROR,
          }),
        );
      }

      if (mediaType.startsWith('text/')) {
        return Effect.succeed(rawBody);
      }

      if (mediaType === 'application/x-www-form-urlencoded') {
        return Effect.succeed(
          Object.fromEntries(new URLSearchParams(rawBody).entries()),
        );
      }

      return Effect.succeed(rawBody);
    }),
  );

const isEmptyRequestBody = (
  request: NextRequest,
): Effect.Effect<boolean, never> =>
  Effect.tryPromise({
    try: () => request.clone().text(),
    catch: () => '',
  }).pipe(
    Effect.orDie,
    Effect.map(rawBody => rawBody.trim().length === 0),
  );

const isOptionalSchema = (schema: RouteBodySchema): boolean => {
  if (!schema) {
    return true;
  }

  const schemaType = schema.constructor.name;
  return schemaType === 'ZodOptional' || schemaType === 'ZodNullable';
};

const validateRequestBody = (
  bodySchema: RouteBodySchema,
  parsedBody: unknown,
): Effect.Effect<unknown, InputError> => {
  if (!bodySchema) {
    return Effect.succeed(parsedBody);
  }

  if (parsedBody === JSON_PARSE_ERROR) {
    return Effect.fail({
      status: HTTP_STATUS.badRequest,
      code: ERROR_CODES.invalidRequestBody,
      message: HTTP_ERROR_MESSAGE.invalidJsonRequestBody,
    });
  }

  if (parsedBody === undefined && isOptionalSchema(bodySchema)) {
    return Effect.succeed(undefined);
  }

  const result = bodySchema.safeParse(parsedBody);
  if (!result.success) {
    return Effect.fail({
      status: HTTP_STATUS.badRequest,
      code: ERROR_CODES.invalidRequestBody,
      message: HTTP_ERROR_MESSAGE.invalidRequestBody,
      details: result.error,
    });
  }

  return Effect.succeed(result.data);
};

const validateMethod = (
  routeMethod: string,
  requestMethod: string,
): Effect.Effect<void, InputError> => {
  if (routeMethod === requestMethod) {
    return Effect.void;
  }

  return Effect.fail({
    status: HTTP_STATUS.methodNotAllowed,
    code: ERROR_CODES.methodNotAllowed,
    message: formatMethodNotAllowedMessage(requestMethod, routeMethod),
  });
};

const resolveAndValidateParams = (
  routeInput: RouteInputConfig,
  paramsPromise: Promise<unknown>,
): Effect.Effect<unknown, InputError> =>
  Effect.gen(function* () {
    if (!routeInput?.params) {
      return {};
    }

    const rawParams = yield* resolveParams(paramsPromise);

    const paramsResult = routeInput.params.safeParse(rawParams);
    if (!paramsResult.success) {
      return yield* Effect.fail({
        status: HTTP_STATUS.badRequest,
        code: ERROR_CODES.invalidParams,
        message: HTTP_ERROR_MESSAGE.invalidPathParameters,
        details: paramsResult.error.issues,
      });
    }

    return paramsResult.data;
  });

const resolveAndValidateQuery = (
  routeInput: RouteInputConfig,
  request: NextRequest,
): Effect.Effect<unknown, InputError> => {
  const rawQuery = Object.fromEntries(
    new URL(request.url).searchParams.entries(),
  );

  if (!routeInput?.query) {
    return Effect.succeed(rawQuery);
  }

  const queryResult = routeInput.query.safeParse(rawQuery);
  if (!queryResult.success) {
    return Effect.fail({
      status: HTTP_STATUS.badRequest,
      code: ERROR_CODES.invalidQuery,
      message: HTTP_ERROR_MESSAGE.invalidQueryParameters,
      details: queryResult.error.issues,
    });
  }

  return Effect.succeed(queryResult.data);
};

const isCompatibleContentType = (
  requestType: string,
  expectedType: string,
): boolean =>
  requestType === expectedType ||
  (isJsonMediaType(requestType) && isJsonMediaType(expectedType));

const resolveAndValidateBody = (
  routeInput: RouteInputConfig,
  request: NextRequest,
): Effect.Effect<unknown, InputError> =>
  Effect.gen(function* () {
    const bodySchema = routeInput?.body;
    if (!bodySchema) {
      return;
    }

    const expectedContentType = routeInput.contentType ?? 'application/json';
    const requestContentType = request.headers.get('content-type') ?? '';
    const normalizedRequestType = normalizeMediaType(requestContentType);
    const normalizedExpectedType = normalizeMediaType(expectedContentType);

    if (
      !isCompatibleContentType(normalizedRequestType, normalizedExpectedType)
    ) {
      const hasEmptyBody = yield* isEmptyRequestBody(request);
      if (hasEmptyBody && isOptionalSchema(bodySchema)) {
        return;
      }

      return yield* Effect.fail({
        status: HTTP_STATUS.unsupportedMediaType,
        code: ERROR_CODES.unsupportedMediaType,
        message: formatUnsupportedMediaTypeMessage(
          requestContentType,
          expectedContentType,
        ),
      });
    }

    const parsedBody = yield* parseRequestBody(request, normalizedRequestType);
    return yield* validateRequestBody(bodySchema, parsedBody);
  });

export const validateInput = async (
  route: Pick<RouteDefinition, 'method' | 'operationId' | 'input'>,
  request: NextRequest,
  paramsPromise: Promise<unknown>,
): Promise<InputValidationResult> => {
  const effect = Effect.gen(function* () {
    yield* validateMethod(route.method, request.method);
    const params = yield* resolveAndValidateParams(route.input, paramsPromise);
    const query = yield* resolveAndValidateQuery(route.input, request);
    const body = yield* resolveAndValidateBody(route.input, request);

    return { params, query, body };
  });

  const resultEither = await Effect.runPromise(Effect.either(effect));
  if (resultEither._tag === 'Left') {
    return { ok: false, error: resultEither.left };
  }

  return { ok: true, data: resultEither.right };
};
