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

const resolveParams = async (
  paramsPromise: Promise<unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: InputError }> => {
  try {
    return { ok: true, data: await paramsPromise };
  } catch (error) {
    return {
      ok: false,
      error: {
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidParams,
        message: 'Invalid path parameters.',
        details: error,
      },
    };
  }
};

const parseRequestBody = async (
  request: Request,
  mediaType: string,
): Promise<unknown | typeof JSON_PARSE_ERROR> => {
  const rawBody = await request.clone().text();

  if (rawBody.trim().length === 0) {
    return;
  }

  if (isJsonMediaType(mediaType)) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return JSON_PARSE_ERROR;
    }
  }

  if (mediaType.startsWith('text/')) {
    return rawBody;
  }

  if (mediaType === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(rawBody).entries());
  }

  return rawBody;
};

const isEmptyRequestBody = async (request: Request): Promise<boolean> => {
  const rawBody = await request.clone().text();
  return rawBody.trim().length === 0;
};

type RouteBodySchema = NonNullable<RouteDefinition['input']>['body'];

const shouldRejectUnsupportedMediaType = async (
  bodySchema: RouteBodySchema | undefined,
  declaredContentType: string,
  requestContentType: string,
  request: Request,
): Promise<boolean> => {
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
  const hasEmptyBody = await isEmptyRequestBody(request);

  return !(
    bodySchemaAllowsUndefined &&
    missingContentTypeHeader &&
    hasEmptyBody
  );
};

export const validateInput = async (
  route: Pick<RouteDefinition, 'method' | 'operationId' | 'input'>,
  request: Request,
  paramsPromise: Promise<unknown>,
): Promise<
  { ok: true; data: InputSuccess } | { ok: false; error: InputError }
> => {
  if (request.method !== route.method) {
    return {
      ok: false,
      error: {
        status: METHOD_NOT_ALLOWED_STATUS,
        code: ERROR_CODES.methodNotAllowed,
        message: 'Method not allowed.',
      },
    };
  }

  const resolvedParams = await resolveParams(paramsPromise);
  if (!resolvedParams.ok) {
    return { ok: false, error: resolvedParams.error };
  }

  const params = resolvedParams.data;
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const requestContentType = normalizeMediaType(
    request.headers.get('content-type'),
  );
  const declaredContentType = normalizeMediaType(route.input?.contentType);

  if (
    await shouldRejectUnsupportedMediaType(
      route.input?.body,
      declaredContentType,
      requestContentType,
      request,
    )
  ) {
    return {
      ok: false,
      error: {
        status: UNSUPPORTED_MEDIA_TYPE_STATUS,
        code: ERROR_CODES.unsupportedMediaType,
        message: 'Invalid media type.',
      },
    };
  }

  const parsedParams = route.input?.params
    ? route.input.params.safeParse(params)
    : { success: true as const, data: params };

  if (!parsedParams.success) {
    return {
      ok: false,
      error: {
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidParams,
        message: 'Invalid path parameters.',
        details: parsedParams.error.issues,
      },
    };
  }

  const parsedQuery = route.input?.query
    ? route.input.query.safeParse(query)
    : { success: true as const, data: query };

  if (!parsedQuery.success) {
    return {
      ok: false,
      error: {
        status: BAD_REQUEST_STATUS,
        code: ERROR_CODES.invalidQuery,
        message: 'Invalid query parameters.',
        details: parsedQuery.error.issues,
      },
    };
  }

  let body: unknown;
  if (route.input?.body) {
    const parsedJson = await parseRequestBody(request, requestContentType);

    if (parsedJson === JSON_PARSE_ERROR) {
      return {
        ok: false,
        error: {
          status: BAD_REQUEST_STATUS,
          code: ERROR_CODES.invalidRequestBody,
          message: 'Invalid request body.',
        },
      };
    }

    const parsedBody = route.input.body.safeParse(parsedJson);
    if (!parsedBody.success) {
      return {
        ok: false,
        error: {
          status: BAD_REQUEST_STATUS,
          code: ERROR_CODES.invalidRequestBody,
          message: 'Invalid request body.',
          details: parsedBody.error.issues,
        },
      };
    }

    body = parsedBody.data;
  }

  return {
    ok: true,
    data: {
      params: parsedParams.data,
      query: parsedQuery.data,
      body: route.input?.body ? body : undefined,
    },
  };
};
