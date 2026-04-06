import { Effect } from 'effect';
import { ERROR_CODES } from '../errors/error-codes';
import { isJsonMediaType, normalizeMediaType } from './media-type';
import type { NextRequest } from 'next/server';
import type { RouteDefinition } from '../contract';

// Input validation types
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

// Constants
const BAD_REQUEST_STATUS = 400;
const METHOD_NOT_ALLOWED_STATUS = 405;
const UNSUPPORTED_MEDIA_TYPE_STATUS = 415;
const JSON_PARSE_ERROR = Symbol('json-parse-error');

// Input validation helpers
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

type RouteBodySchema = NonNullable<RouteDefinition['input']>['body'];

const isOptionalSchema = (schema: RouteBodySchema): boolean => {
  if (!schema) {
    return true;
  }
  // Check for ZodOptional, ZodNullable, or ZodDefault
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

  // Handle JSON parse error
  if (parsedBody === JSON_PARSE_ERROR) {
    return Effect.fail({
      status: BAD_REQUEST_STATUS,
      code: ERROR_CODES.invalidRequestBody,
      message: 'Invalid JSON in request body.',
    });
  }

  // Handle empty body for optional schemas
  if (parsedBody === undefined && isOptionalSchema(bodySchema)) {
    return Effect.succeed(undefined);
  }

  const result = bodySchema.safeParse(parsedBody);

  if (!result.success) {
    return Effect.fail({
      status: BAD_REQUEST_STATUS,
      code: ERROR_CODES.invalidRequestBody,
      message: 'Request body validation failed.',
      details: result.error,
    });
  }

  return Effect.succeed(result.data);
};

type InputValidationResult =
  | { ok: true; data: InputSuccess }
  | { ok: false; error: InputError };

export const validateInput = async (
  route: Pick<RouteDefinition, 'method' | 'operationId' | 'input'>,
  request: NextRequest,
  paramsPromise: Promise<unknown>,
): Promise<InputValidationResult> => {
  const effect = Effect.gen(function* () {
    // Check HTTP method
    if (route.method !== request.method) {
      return yield* Effect.fail({
        status: METHOD_NOT_ALLOWED_STATUS,
        code: ERROR_CODES.methodNotAllowed,
        message: `Method ${request.method} not allowed. Expected ${route.method}.`,
      });
    }

    // Resolve and validate params
    const rawParams = yield* resolveParams(paramsPromise);
    const paramsResult = route.input?.params
      ? route.input.params.safeParse(rawParams)
      : { success: true as const, data: rawParams };
    if (!paramsResult.success) {
      return yield* Effect.fail({
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidParams,
        message: 'Invalid path parameters.',
        details: paramsResult.error.issues,
      });
    }
    const params = paramsResult.data;

    // Parse and validate query from URL
    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const queryResult = route.input?.query
      ? route.input.query.safeParse(rawQuery)
      : { success: true as const, data: rawQuery };
    if (!queryResult.success) {
      return yield* Effect.fail({
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidQuery,
        message: 'Invalid query parameters.',
        details: queryResult.error.issues,
      });
    }
    const query = queryResult.data;

    // Handle body validation
    let body: unknown;
    const bodySchema = route.input?.body;
    const contentType = route.input?.contentType ?? 'application/json';

    if (bodySchema) {
      const requestContentType = request.headers.get('content-type') ?? '';
      const normalizedRequestType = normalizeMediaType(requestContentType);
      const normalizedExpectedType = normalizeMediaType(contentType);

      // Check content-type match (but be lenient with json suffixes)
      if (
        normalizedRequestType !== normalizedExpectedType &&
        !(
          isJsonMediaType(normalizedRequestType) &&
          isJsonMediaType(normalizedExpectedType)
        )
      ) {
        // Allow empty body for optional schemas
        const hasEmptyBody = yield* isEmptyRequestBody(request);
        if (!(hasEmptyBody && isOptionalSchema(bodySchema))) {
          return yield* Effect.fail({
            status: UNSUPPORTED_MEDIA_TYPE_STATUS,
            code: ERROR_CODES.unsupportedMediaType,
            message: `Content-Type ${requestContentType} not supported. Expected ${contentType}.`,
          });
        }
        body = undefined;
      } else {
        const parsedBody = yield* parseRequestBody(
          request,
          normalizedRequestType,
        );
        body = yield* validateRequestBody(bodySchema, parsedBody);
      }
    }

    return { params, query, body };
  });

  const resultEither = await Effect.runPromise(Effect.either(effect));

  if (resultEither._tag === 'Left') {
    return { ok: false, error: resultEither.left };
  }

  return { ok: true, data: resultEither.right };
};
