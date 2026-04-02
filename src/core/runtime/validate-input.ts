import { Effect } from 'effect';
import { ERROR_CODES } from '../errors/error-codes';
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

const normalizeMediaType = (contentType: string | null | undefined): string =>
  contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';

const isJsonMediaType = (mediaType: string): boolean =>
  mediaType === 'application/json' || mediaType.endsWith('+json');

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
 * Internal Effect-based validation.
 */
const validateInputEffect = (
  route: Pick<RouteDefinition, 'method' | 'operationId' | 'input'>,
  request: Request,
  paramsPromise: Promise<unknown>,
): Effect.Effect<InputSuccess, InputError> =>
  Effect.gen(function* () {
    if (request.method !== route.method) {
      return yield* Effect.fail({
        status: METHOD_NOT_ALLOWED_STATUS,
        code: ERROR_CODES.methodNotAllowed,
        message: 'Method not allowed.',
      });
    }

    const params = yield* resolveParams(paramsPromise);

    const query = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    const requestContentType = normalizeMediaType(
      request.headers.get('content-type'),
    );
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

    // Validate body
    let body: unknown;
    if (route.input?.body) {
      const parsedJson = yield* parseRequestBody(request, requestContentType);

      if (parsedJson === JSON_PARSE_ERROR) {
        return yield* Effect.fail({
          status: BAD_REQUEST_STATUS,
          code: ERROR_CODES.invalidRequestBody,
          message: 'Invalid request body.',
        });
      }

      const parsedBody = route.input.body.safeParse(parsedJson);
      if (!parsedBody.success) {
        return yield* Effect.fail({
          status: BAD_REQUEST_STATUS,
          code: ERROR_CODES.invalidRequestBody,
          message: 'Invalid request body.',
          details: parsedBody.error.issues,
        });
      }

      body = parsedBody.data;
    }

    return {
      params: parsedParams.data,
      query: parsedQuery.data,
      body: route.input?.body ? body : undefined,
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
