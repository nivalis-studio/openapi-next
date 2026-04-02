import { describe, expect, it } from 'bun:test';
import { errorResponseBody, internalErrorBody } from './error-shape';

const BAD_REQUEST_STATUS = 400;

describe('error-shape', () => {
  it('returns stable public shape without leaking stack traces', () => {
    const err = new Error('db password leaked');
    const body = internalErrorBody(err);

    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unknown error occurred.');
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
