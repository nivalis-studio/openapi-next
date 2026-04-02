import { ERROR_CODES, type ErrorCode } from './error-codes';

const INTERNAL_SERVER_ERROR_STATUS = 500;

export type PublicErrorBody = {
  success: false;
  timestamp: string;
  statusCode: number;
  error: {
    code: ErrorCode;
    message: string;
  };
};

export const errorResponseBody = (
  code: ErrorCode,
  message: string,
  statusCode: number,
): PublicErrorBody => ({
  success: false,
  timestamp: new Date().toISOString(),
  statusCode,
  error: {
    code,
    message,
  },
});

export const internalErrorBody = (_error: unknown): PublicErrorBody =>
  errorResponseBody(
    ERROR_CODES.internal,
    'An unknown error occurred.',
    INTERNAL_SERVER_ERROR_STATUS,
  );
