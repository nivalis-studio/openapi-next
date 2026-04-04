import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { executeRoute } from './execute-route';

const BAD_REQUEST_STATUS = 400;
const INTERNAL_SERVER_ERROR_STATUS = 500;
const OK_STATUS = 200;
const TEXT_PLAIN = 'text/plain';

describe('executeRoute', () => {
  it('maps response validation failures to 500 RESPONSE_VALIDATION_FAILED', async () => {
    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'invalid-output',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: z.object({ count: z.number().int() }),
              },
            },
          },
        },
        handler: () => ({
          status: 200,
          contentType: 'application/json',
          body: { count: 'not-a-number' },
        }),
      },
      new Request('https://api.test/items', { method: 'GET' }),
      Promise.resolve({}),
    );

    expect(response.status).toBe(INTERNAL_SERVER_ERROR_STATUS);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RESPONSE_VALIDATION_FAILED');
  });

  it('returns success response with normalized validated output body', async () => {
    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'valid-output',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: z.object({ count: z.coerce.number().int() }),
              },
            },
          },
        },
        handler: () => ({
          status: 200,
          contentType: 'application/json',
          body: { count: '42' },
        }),
      },
      new Request('https://api.test/items', { method: 'GET' }),
      Promise.resolve({}),
    );

    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ count: 42 });
  });

  it('returns non-JSON success response body unchanged', async () => {
    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'plain-text-output',
        responses: {
          200: {
            description: 'ok',
            content: {
              'text/plain': { schema: z.string() },
            },
          },
        },
        handler: () => ({
          status: 200,
          contentType: TEXT_PLAIN,
          body: 'hello world',
        }),
      },
      new Request('https://api.test/items', { method: 'GET' }),
      Promise.resolve({}),
    );

    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('content-type')).toBe(TEXT_PLAIN);
    expect(await response.text()).toBe('hello world');
  });

  it('preserves custom headers for Headers and tuple-array variants', async () => {
    const responseWithHeaders = await executeRoute(
      {
        method: 'GET',
        operationId: 'headers-instance',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': { schema: z.object({ ok: z.boolean() }) },
            },
          },
        },
        handler: () => ({
          status: 200,
          contentType: 'application/json',
          body: { ok: true },
          headers: new Headers({ 'x-request-id': 'from-headers' }),
        }),
      },
      new Request('https://api.test/items', { method: 'GET' }),
      Promise.resolve({}),
    );

    expect(responseWithHeaders.headers.get('x-request-id')).toBe(
      'from-headers',
    );
    expect(responseWithHeaders.headers.get('content-type')).toContain(
      'application/json',
    );

    const responseWithTupleArray = await executeRoute(
      {
        method: 'GET',
        operationId: 'headers-tuple-array',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': { schema: z.object({ ok: z.boolean() }) },
            },
          },
        },
        handler: () => ({
          status: 200,
          contentType: 'application/json',
          body: { ok: true },
          headers: [['x-trace-id', 'from-tuple-array']],
        }),
      },
      new Request('https://api.test/items', { method: 'GET' }),
      Promise.resolve({}),
    );

    expect(responseWithTupleArray.headers.get('x-trace-id')).toBe(
      'from-tuple-array',
    );
    expect(responseWithTupleArray.headers.get('content-type')).toContain(
      'application/json',
    );
  });

  it('normalizes object-style headers and enforces response content-type', async () => {
    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'headers-object',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': { schema: z.object({ ok: z.boolean() }) },
            },
          },
        },
        handler: () => ({
          status: 200,
          contentType: 'application/json',
          body: { ok: true },
          headers: {
            'x-request-id': 'from-object',
            'content-type': TEXT_PLAIN,
          },
        }),
      },
      new Request('https://api.test/items', { method: 'GET' }),
      Promise.resolve({}),
    );

    expect(response.headers.get('x-request-id')).toBe('from-object');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ ok: true });
  });

  it('treats +json content types as JSON responses', async () => {
    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'problem-json-output',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/problem+json': {
                schema: z.object({ detail: z.coerce.string() }),
              },
            },
          },
        },
        handler: () => ({
          status: 200,
          contentType: 'application/problem+json; charset=utf-8',
          body: { detail: 404 },
        }),
      },
      new Request('https://api.test/items', { method: 'GET' }),
      Promise.resolve({}),
    );

    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    );
    expect(await response.json()).toEqual({ detail: '404' });
  });

  it('returns sanitized 500 when handler throws', async () => {
    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'throws',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': { schema: z.object({ ok: z.boolean() }) },
            },
          },
        },
        handler: () => {
          throw new Error('do not leak this');
        },
      },
      new Request('https://api.test/items', { method: 'GET' }),
      Promise.resolve({}),
    );

    expect(response.status).toBe(INTERNAL_SERVER_ERROR_STATUS);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('do not leak this');
  });

  it('supports next-style bound handlers with request context and validated input', async () => {
    const request = new Request('https://api.test/items?page=2', {
      method: 'GET',
    });
    const context = { params: Promise.resolve({ tenant: 'eu' }) };
    let didReceiveSameRequest = false;
    let didReceiveSameContext = false;

    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'bound-handler-input',
        input: {
          query: z.object({ page: z.coerce.number().int().min(1) }),
        },
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: z.object({ echo: z.string() }),
              },
            },
          },
        },
      },
      (receivedRequest, receivedContext, input) => {
        didReceiveSameRequest = receivedRequest === request;
        didReceiveSameContext = receivedContext === context;

        return {
          status: 200,
          contentType: 'application/json',
          body: { echo: `${receivedRequest.method}:${input.query.page}` },
        };
      },
      request,
      context,
    );

    expect(didReceiveSameRequest).toBe(true);
    expect(didReceiveSameContext).toBe(true);
    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ echo: 'GET:2' });
  });

  it('defaults to application/json when contentType is not provided', async () => {
    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'default-content-type',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: z.object({ ok: z.boolean() }),
              },
            },
          },
        },
      },
      async () => ({
        status: 200,
        body: { ok: true },
      }),
      new Request('https://api.test/items', { method: 'GET' }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(OK_STATUS);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ ok: true });
  });

  it('does not call next-style handler when input validation fails', async () => {
    let wasHandlerCalled = false;

    const response = await executeRoute(
      {
        method: 'GET',
        operationId: 'bound-handler-invalid-query',
        input: {
          query: z.object({ page: z.coerce.number().int().min(1) }),
        },
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: z.object({ ok: z.boolean() }),
              },
            },
          },
        },
      },
      () => {
        wasHandlerCalled = true;

        return {
          status: 200,
          contentType: 'application/json',
          body: { ok: true },
        };
      },
      new Request('https://api.test/items?page=not-a-number', {
        method: 'GET',
      }),
      { params: Promise.resolve({}) },
    );

    expect(wasHandlerCalled).toBe(false);
    expect(response.status).toBe(BAD_REQUEST_STATUS);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_QUERY');
  });
});
