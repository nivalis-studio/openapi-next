import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { validateOutput } from './validation';

const INTERNAL_SERVER_ERROR_STATUS = 500;

describe('validateOutput', () => {
  it('rejects unknown content type', () => {
    const result = validateOutput(
      {
        200: {
          description: 'ok',
          content: {
            'application/json': { schema: z.object({ ok: z.literal(true) }) },
          },
        },
      },
      {
        status: 200,
        contentType: 'text/plain',
        body: { ok: true },
      },
      'text/plain',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(INTERNAL_SERVER_ERROR_STATUS);
      expect(result.code).toBe('RESPONSE_VALIDATION_FAILED');
    }
  });

  it('rejects schema-invalid body', () => {
    const result = validateOutput(
      {
        200: {
          description: 'ok',
          content: {
            'application/json': {
              schema: z.object({ count: z.number().int() }),
            },
          },
        },
      },
      {
        status: 200,
        contentType: 'application/json',
        body: { count: 'not-a-number' },
      },
      'application/json',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(INTERNAL_SERVER_ERROR_STATUS);
      expect(result.code).toBe('RESPONSE_VALIDATION_FAILED');
    }
  });

  it('returns normalized parsed body on success', () => {
    const result = validateOutput(
      {
        200: {
          description: 'ok',
          content: {
            'application/json': {
              schema: z.object({ count: z.coerce.number().int() }),
            },
          },
        },
      },
      {
        status: 200,
        contentType: 'application/json',
        body: { count: '42' },
      },
      'application/json',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toEqual({ count: 42 });
    }
  });
});
