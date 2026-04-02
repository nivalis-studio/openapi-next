import { errorResponseBody, internalErrorBody } from '../errors/error-shape';
import { validateInput } from './validate-input';
import { validateOutput } from './validate-output';
import type { RouteDefinition, RouteHeaders } from '../contract';
import type { ErrorCode } from '../errors/error-codes';

const asErrorCode = (code: string): ErrorCode => code as ErrorCode;
const INTERNAL_SERVER_ERROR_STATUS = 500;

const isJsonContentType = (contentType: string): boolean => {
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType.endsWith('+json');
};

const normalizeHeaders = (
  headers: RouteHeaders | undefined,
  contentType: string,
): Headers => {
  const normalized = new Headers(headers);
  normalized.set('content-type', contentType);
  return normalized;
};

type ResponseBody = ConstructorParameters<typeof Response>[0];

const toResponseBody = (body: unknown): ResponseBody => {
  if (body == null) {
    return null;
  }
  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream
  ) {
    return body;
  }

  return String(body);
};

export const executeRoute = async (
  route: RouteDefinition,
  request: Request,
  paramsPromise: Promise<unknown>,
): Promise<Response> => {
  try {
    const input = await validateInput(route, request, paramsPromise);
    if (!input.ok) {
      return Response.json(
        errorResponseBody(
          asErrorCode(input.error.code),
          input.error.message,
          input.error.status,
        ),
        { status: input.error.status },
      );
    }

    const result = await route.handler(input.data);
    const output = validateOutput(route.responses, result);
    if (!output.ok) {
      return Response.json(
        errorResponseBody(output.code, output.message, output.status),
        { status: output.status },
      );
    }

    const headers = normalizeHeaders(result.headers, result.contentType);

    if (isJsonContentType(result.contentType)) {
      return Response.json(output.body, {
        status: result.status,
        headers,
      });
    }

    return new Response(toResponseBody(output.body), {
      status: result.status,
      headers,
    });
  } catch (error) {
    return Response.json(internalErrorBody(error), {
      status: INTERNAL_SERVER_ERROR_STATUS,
    });
  }
};
