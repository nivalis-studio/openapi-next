import { Effect } from 'effect';
import { ERROR_CODES } from '../errors/error-codes';
import type { RouteHandlerResult, RouteResponses } from '../contract';
import type { ErrorCode } from '../errors/error-codes';

type OutputValidationResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number; code: ErrorCode; message: string };

const INTERNAL_SERVER_ERROR_STATUS = 500;

const normalizeMediaType = (contentType: string): string =>
  contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';

type OutputError = {
  status: number;
  code: ErrorCode;
  message: string;
};

/**
 * Internal Effect-based output validation.
 */
const validateOutputEffect = (
  responses: RouteResponses,
  result: RouteHandlerResult,
  contentType: string,
): Effect.Effect<unknown, OutputError> =>
  Effect.gen(function* () {
    const responseDef = responses[result.status];
    if (!responseDef) {
      return yield* Effect.fail({
        status: INTERNAL_SERVER_ERROR_STATUS,
        code: ERROR_CODES.responseValidationFailed,
        message: `Undeclared response status: ${result.status}`,
      });
    }

    const requestedMediaType = normalizeMediaType(contentType);
    const mediaDef =
      responseDef.content[contentType] ??
      responseDef.content[requestedMediaType] ??
      Object.entries(responseDef.content).find(
        ([ct]) => normalizeMediaType(ct) === requestedMediaType,
      )?.[1];

    if (!mediaDef) {
      return yield* Effect.fail({
        status: INTERNAL_SERVER_ERROR_STATUS,
        code: ERROR_CODES.responseValidationFailed,
        message: `Undeclared response content type: ${contentType}`,
      });
    }

    const parsed = mediaDef.schema.safeParse(result.body);
    if (!parsed.success) {
      return yield* Effect.fail({
        status: INTERNAL_SERVER_ERROR_STATUS,
        code: ERROR_CODES.responseValidationFailed,
        message: 'Response body failed schema validation.',
      });
    }

    return parsed.data;
  });

/**
 * Validate route handler output against response definitions.
 * Public API remains unchanged - returns sync result with ok/error shape.
 */
export const validateOutput = (
  responses: RouteResponses,
  result: RouteHandlerResult,
  contentType: string,
): OutputValidationResult => {
  const effect = validateOutputEffect(responses, result, contentType);
  const resultEither = Effect.runSync(Effect.either(effect));

  if (resultEither._tag === 'Left') {
    return { ok: false, ...resultEither.left };
  }

  return { ok: true, body: resultEither.right };
};
