import { describe, expect, it } from 'bun:test';
import { HTTP_ERROR_MESSAGE, HTTP_STATUS } from '../../lib/http';
import { errorResponseBody, internalErrorBody } from './error-shape';

const BAD_REQUEST_STATUS = HTTP_STATUS.badRequest;

describe('error-shape', () => {
  it('returns stable public shape without leaking stack traces', () => {
    const err = new Error('db password leaked');
    const body = internalErrorBody(err);

    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe(HTTP_ERROR_MESSAGE.internalServerError);
    expect(JSON.stringify(body)).not.toContain('db password leaked');
  });

  it('builds validation errors with explicit code', () => {
    const body = errorResponseBody(
      'INVALID_REQUEST_BODY',
      'Invalid request body.',
      BAD_REQUEST_STATUS,
    );

    expect(body.statusCode).toBe(BAD_REQUEST_STATUS);
    expect(body.error.code).toBe('INVALID_REQUEST_BODY');
  });
});
