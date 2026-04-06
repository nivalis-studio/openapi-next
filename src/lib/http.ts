export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  badRequest: 400,
  methodNotAllowed: 405,
  unsupportedMediaType: 415,
  internalServerError: 500,
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

export const HTTP_STATUS_MESSAGE: Record<HttpStatusCode, string> = {
  [HTTP_STATUS.ok]: 'OK',
  [HTTP_STATUS.created]: 'Created',
  [HTTP_STATUS.badRequest]: 'Bad Request',
  [HTTP_STATUS.methodNotAllowed]: 'Method Not Allowed',
  [HTTP_STATUS.unsupportedMediaType]: 'Unsupported Media Type',
  [HTTP_STATUS.internalServerError]: 'Internal Server Error',
};

export const HTTP_ERROR_MESSAGE = {
  internalServerError: 'An unknown error occurred.',
  invalidPathParameters: 'Invalid path parameters.',
  invalidQueryParameters: 'Invalid query parameters.',
  invalidJsonRequestBody: 'Invalid JSON in request body.',
  invalidRequestBody: 'Request body validation failed.',
} as const;

export const formatMethodNotAllowedMessage = (
  method: string,
  expectedMethod: string,
): string => `Method ${method} not allowed. Expected ${expectedMethod}.`;

export const formatUnsupportedMediaTypeMessage = (
  mediaType: string,
  expectedMediaType: string,
): string =>
  `Content-Type ${mediaType} not supported. Expected ${expectedMediaType}.`;
