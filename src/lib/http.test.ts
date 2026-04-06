import { describe, expect, it } from 'bun:test';
import {
  formatMethodNotAllowedMessage,
  formatUnsupportedMediaTypeMessage,
  HTTP_STATUS,
  HTTP_STATUS_MESSAGE,
} from './http';

const EXPECTED_OK = 200;
const EXPECTED_CREATED = 201;
const EXPECTED_BAD_REQUEST = 400;
const EXPECTED_METHOD_NOT_ALLOWED = 405;
const EXPECTED_UNSUPPORTED_MEDIA_TYPE = 415;
const EXPECTED_INTERNAL_SERVER_ERROR = 500;

describe('http constants', () => {
  it('exposes a single source of truth for status codes and messages', () => {
    expect(HTTP_STATUS.ok).toBe(EXPECTED_OK);
    expect(HTTP_STATUS.created).toBe(EXPECTED_CREATED);
    expect(HTTP_STATUS.badRequest).toBe(EXPECTED_BAD_REQUEST);
    expect(HTTP_STATUS.methodNotAllowed).toBe(EXPECTED_METHOD_NOT_ALLOWED);
    expect(HTTP_STATUS.unsupportedMediaType).toBe(
      EXPECTED_UNSUPPORTED_MEDIA_TYPE,
    );
    expect(HTTP_STATUS.internalServerError).toBe(
      EXPECTED_INTERNAL_SERVER_ERROR,
    );

    expect(HTTP_STATUS_MESSAGE[HTTP_STATUS.ok]).toBe('OK');
    expect(HTTP_STATUS_MESSAGE[HTTP_STATUS.created]).toBe('Created');
    expect(HTTP_STATUS_MESSAGE[HTTP_STATUS.badRequest]).toBe('Bad Request');
    expect(HTTP_STATUS_MESSAGE[HTTP_STATUS.methodNotAllowed]).toBe(
      'Method Not Allowed',
    );
    expect(HTTP_STATUS_MESSAGE[HTTP_STATUS.unsupportedMediaType]).toBe(
      'Unsupported Media Type',
    );
    expect(HTTP_STATUS_MESSAGE[HTTP_STATUS.internalServerError]).toBe(
      'Internal Server Error',
    );
  });

  it('formats method and media-type messages consistently', () => {
    expect(formatMethodNotAllowedMessage('POST', 'GET')).toBe(
      'Method POST not allowed. Expected GET.',
    );
    expect(
      formatUnsupportedMediaTypeMessage('text/plain', 'application/json'),
    ).toBe('Content-Type text/plain not supported. Expected application/json.');
  });
});
