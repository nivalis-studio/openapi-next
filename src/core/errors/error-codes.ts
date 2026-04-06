export const ERROR_CODES = {
  internal: 'INTERNAL_ERROR',
  methodNotAllowed: 'METHOD_NOT_ALLOWED',
  unsupportedMediaType: 'UNSUPPORTED_MEDIA_TYPE',
  invalidRequestBody: 'INVALID_REQUEST_BODY',
  invalidQuery: 'INVALID_QUERY',
  invalidParams: 'INVALID_PARAMS',
  schemaConversionFailed: 'SCHEMA_CONVERSION_FAILED',
  duplicateOperationId: 'DUPLICATE_OPERATION_ID',
  duplicatePathMethod: 'DUPLICATE_PATH_METHOD',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
