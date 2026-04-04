import { Effect } from 'effect';
import { ERROR_CODES } from '../errors/error-codes';
import { isJsonMediaType, normalizeMediaType } from './media-type';
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

const BAD_REQUEST_STATUS = 400;
const METHOD_NOT_ALLOWED_STATUS = 405;
const UNSUPPORTED_MEDIA_TYPE_STATUS = 415;
const JSON_PARSE_ERROR = Symbol('json-parse-error');

/**
 * Resolve params from the Next.js context params promise.
 * Returns an Effect that fails with InputError if the promise rejects.
 */
const resolveParams = (
  paramsPromise: Promise<unknown>,
): Effect.Effect<unknown, InputError> =>
  Effect.tryPromise({
    try: () => paramsPromise,
    catch: error => ({
      status: BAD_REQUEST_STATUS,
      code: ERROR_CODES.invalidParams,
      message: 'Invalid path parameters.',
      details: error,
    }),
  });

/**
 * Parse request body based on media type.
 * Returns an Effect that always succeeds with the parsed body or undefined.
 */
const parseRequestBody = (
  request: Request,
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

/**
 * Check if request body is empty.
 */
const isEmptyRequestBody = (request: Request): Effect.Effect<boolean, never> =>
  Effect.tryPromise({
    try: () => request.clone().text(),
    catch: () => '',
  }).pipe(
    Effect.orDie,
    Effect.map(rawBody => rawBody.trim().length === 0),
  );

type RouteBodySchema = NonNullable<RouteDefinition['input']>['body'];

/**
 * Determine if request should be rejected due to unsupported media type.
 */
const shouldRejectUnsupportedMediaType = (
  bodySchema: RouteBodySchema | undefined,
  declaredContentType: string,
  requestContentType: string,
  request: Request,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    if (!bodySchema) {
      return false;
    }

    if (declaredContentType.length === 0) {
      return false;
    }

    if (requestContentType === declaredContentType) {
      return false;
    }

    const bodySchemaAllowsUndefined = bodySchema.safeParse(undefined).success;
    const missingContentTypeHeader = requestContentType.length === 0;
    const hasEmptyBody = yield* isEmptyRequestBody(request);

    return !(
      bodySchemaAllowsUndefined &&
      missingContentTypeHeader &&
      hasEmptyBody
    );
  });

type InputValidationResult =
  | { ok: true; data: InputSuccess }
  | { ok: false; error: InputError };

/**
 * Validate request method matches route method.
 */
const validateMethod = (
  route: Pick<RouteDefinition, 'method'>,
  request: Request,
): Effect.Effect<void, InputError> =>
  request.method === route.method
    ? Effect.void
    : Effect.fail({
        status: METHOD_NOT_ALLOWED_STATUS,
        code: ERROR_CODES.methodNotAllowed,
        message: 'Method not allowed.',
      });

/**
 * Validate content type is acceptable for the route.
 */
const validateContentType = (
  route: Pick<RouteDefinition, 'input'>,
  request: Request,
  requestContentType: string,
): Effect.Effect<void, InputError> =>
  Effect.gen(function* () {
    const declaredContentType = normalizeMediaType(route.input?.contentType);
    const shouldReject = yield* shouldRejectUnsupportedMediaType(
      route.input?.body,
      declaredContentType,
      requestContentType,
      request,
    );

    if (shouldReject) {
      return yield* Effect.fail({
        status: UNSUPPORTED_MEDIA_TYPE_STATUS,
        code: ERROR_CODES.unsupportedMediaType,
        message: 'Invalid media type.',
      });
    }
  });

/**
 * Parse and validate request body.
 */
const validateBody = (
  bodySchema: RouteBodySchema | undefined,
  request: Request,
  requestContentType: string,
): Effect.Effect<unknown | undefined, InputError> =>
  Effect.gen(function* () {
    if (!bodySchema) {
      return;
    }

    const parsedJson = yield* parseRequestBody(request, requestContentType);

    if (parsedJson === JSON_PARSE_ERROR) {
      return yield* Effect.fail({
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidRequestBody,
        message: 'Invalid request body.',
      });
    }

    const parsedBody = bodySchema.safeParse(parsedJson);
    if (!parsedBody.success) {
      return yield* Effect.fail({
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidRequestBody,
        message: 'Invalid request body.',
        details: parsedBody.error.issues,
      });
    }

    return parsedBody.data;
  });

/**
 * Internal Effect-based validation.
 */
const validateInputEffect = (
  route: Pick<RouteDefinition, 'method' | 'operationId' | 'input'>,
  request: Request,
  paramsPromise: Promise<unknown>,
): Effect.Effect<InputSuccess, InputError> =>
  Effect.gen(function* () {
    const requestContentType = normalizeMediaType(
      request.headers.get('content-type'),
    );

    yield* validateMethod(route, request);

    const params = yield* resolveParams(paramsPromise);

    const query = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );

    yield* validateContentType(route, request, requestContentType);

    const parsedParams = route.input?.params
      ? route.input.params.safeParse(params)
      : { success: true as const, data: params };

    if (!parsedParams.success) {
      return yield* Effect.fail({
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidParams,
        message: 'Invalid path parameters.',
        details: parsedParams.error.issues,
      });
    }

    const parsedQuery = route.input?.query
      ? route.input.query.safeParse(query)
      : { success: true as const, data: query };

    if (!parsedQuery.success) {
      return yield* Effect.fail({
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidQuery,
        message: 'Invalid query parameters.',
        details: parsedQuery.error.issues,
      });
    }

    const body = yield* validateBody(
      route.input?.body,
      request,
      requestContentType,
    );

    return {
      params: parsedParams.data,
      query: parsedQuery.data,
      body,
    };
  });

/**
 * Validate request input against route definition.
 * Public API remains unchanged - returns Promise with ok/error result.
 */
export const validateInput = async (
  route: Pick<RouteDefinition, 'method' | 'operationId' | 'input'>,
  request: Request,
  paramsPromise: Promise<unknown>,
): Promise<InputValidationResult> => {
  const effect = validateInputEffect(route, request, paramsPromise);
  const result = await Effect.runPromise(Effect.either(effect));

  if (result._tag === 'Left') {
    return { ok: false, error: result.left };
  }

  return { ok: true, data: result.right };
};
