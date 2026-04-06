import { HTTP_ERROR_MESSAGE, HTTP_STATUS } from '../../lib/http';
import { ERROR_CODES, type ErrorCode } from './error-codes';

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
    HTTP_ERROR_MESSAGE.internalServerError,
    HTTP_STATUS.internalServerError,
  );
