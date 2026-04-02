import { ERROR_CODES } from '../errors/error-codes';
import type { RouteHandlerResult, RouteResponses } from '../contract';
import type { ErrorCode } from '../errors/error-codes';

type OutputValidationResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number; code: ErrorCode; message: string };

const INTERNAL_SERVER_ERROR_STATUS = 500;

const normalizeMediaType = (contentType: string): string =>
  contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';

export const validateOutput = (
  responses: RouteResponses,
  result: RouteHandlerResult,
): OutputValidationResult => {
  const responseDef = responses[result.status];
  if (!responseDef) {
    return {
      ok: false,
      status: INTERNAL_SERVER_ERROR_STATUS,
      code: ERROR_CODES.responseValidationFailed,
      message: `Undeclared response status: ${result.status}`,
    };
  }

  const requestedMediaType = normalizeMediaType(result.contentType);
  const mediaDef =
    responseDef.content[result.contentType] ??
    responseDef.content[requestedMediaType] ??
    Object.entries(responseDef.content).find(
      ([contentType]) => normalizeMediaType(contentType) === requestedMediaType,
    )?.[1];
  if (!mediaDef) {
    return {
      ok: false,
      status: INTERNAL_SERVER_ERROR_STATUS,
      code: ERROR_CODES.responseValidationFailed,
      message: `Undeclared response content type: ${result.contentType}`,
    };
  }

  const parsed = mediaDef.schema.safeParse(result.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: INTERNAL_SERVER_ERROR_STATUS,
      code: ERROR_CODES.responseValidationFailed,
      message: 'Response body failed schema validation.',
    };
  }

  return { ok: true, body: parsed.data };
};
