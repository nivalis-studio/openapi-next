import { describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { HTTP_ERROR_MESSAGE, HTTP_STATUS } from '../../lib/http';
import { validateInput } from './validation';

const BAD_REQUEST_STATUS = HTTP_STATUS.badRequest;
const METHOD_NOT_ALLOWED_STATUS = HTTP_STATUS.methodNotAllowed;
const UNSUPPORTED_MEDIA_TYPE_STATUS = HTTP_STATUS.unsupportedMediaType;

describe('validateInput', () => {
  it('rejects mismatched content-type when body schema exists', async () => {
    const req = new NextRequest('https://api.test/users', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'x',
    });

    const result = await validateInput(
      {
        method: 'POST',
        operationId: 'createUser',
        input: {
          body: z.object({ name: z.string() }),
          contentType: 'application/json',
        },
      },
      req,
      Promise.resolve({}),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(UNSUPPORTED_MEDIA_TYPE_STATUS);
    }
  });

  it('parses and validates params query and body for valid request', async () => {
    const req = new NextRequest('https://api.test/users?page=2', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    });

    const result = await validateInput(
      {
        method: 'POST',
        operationId: 'createUser',
        input: {
          params: z.object({ teamId: z.string() }),
          query: z.object({ page: z.coerce.number() }),
          body: z.object({ name: z.string() }),
          contentType: 'application/json',
        },
      },
      req,
      Promise.resolve({ teamId: 't1' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.query).toEqual({ page: 2 });
      expect(result.data.params).toEqual({ teamId: 't1' });
      expect(result.data.body).toEqual({ name: 'Ada' });
    }
  });

  it('returns invalidRequestBody for malformed json body', async () => {
    const req = new NextRequest('https://api.test/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":',
    });

    const result = await validateInput(
      {
        method: 'POST',
        operationId: 'createUser',
        input: {
          body: z.object({ name: z.string() }),
          contentType: 'application/json',
        },
      },
      req,
      Promise.resolve({}),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(BAD_REQUEST_STATUS);
      expect(result.error.code).toBe('INVALID_REQUEST_BODY');
    }
  });

  it('parses and validates text/plain request bodies as strings', async () => {
    const req = new NextRequest('https://api.test/messages', {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'hello world',
    });

    const result = await validateInput(
      {
        method: 'POST',
        operationId: 'createMessage',
        input: {
          body: z.string().min(1),
          contentType: 'text/plain',
        },
      },
      req,
      Promise.resolve({}),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toBe('hello world');
    }
  });

  it('parses and validates +json media type request bodies as JSON objects', async () => {
    const req = new NextRequest('https://api.test/problems', {
      method: 'POST',
      headers: { 'content-type': 'application/problem+json; charset=utf-8' },
      body: JSON.stringify({
        title: 'Invalid input',
      }),
    });

    const result = await validateInput(
      {
        method: 'POST',
        operationId: 'createProblem',
        input: {
          body: z.object({
            title: z.string(),
          }),
          contentType: 'application/problem+json',
        },
      },
      req,
      Promise.resolve({}),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toEqual({ title: 'Invalid input' });
    }
  });

  it('returns methodNotAllowed when request method does not match route method', async () => {
    const req = new NextRequest('https://api.test/users', { method: 'GET' });

    const result = await validateInput(
      {
        method: 'POST',
        operationId: 'createUser',
        input: {},
      },
      req,
      Promise.resolve({}),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(METHOD_NOT_ALLOWED_STATUS);
      expect(result.error.code).toBe('METHOD_NOT_ALLOWED');
    }
  });

  it('handles paramsPromise rejection as invalidParams error', async () => {
    const req = new NextRequest('https://api.test/users', { method: 'GET' });

    const result = await validateInput(
      {
        method: 'GET',
        operationId: 'listUsers',
        input: {
          params: z.object({ teamId: z.string() }),
        },
      },
      req,
      Promise.reject(new Error('bad params')),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(BAD_REQUEST_STATUS);
      expect(result.error.code).toBe('INVALID_PARAMS');
      expect(result.error.message).toBe(
        HTTP_ERROR_MESSAGE.invalidPathParameters,
      );
    }
  });

  it('accepts empty body when body schema is optional', async () => {
    const req = new NextRequest('https://api.test/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    const result = await validateInput(
      {
        method: 'POST',
        operationId: 'createUser',
        input: {
          body: z
            .object({
              name: z.string(),
            })
            .optional(),
          contentType: 'application/json',
        },
      },
      req,
      Promise.resolve({}),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toBeUndefined();
    }
  });

  it('accepts missing content-type when optional body is empty', async () => {
    const req = new NextRequest('https://api.test/users', {
      method: 'POST',
    });

    const result = await validateInput(
      {
        method: 'POST',
        operationId: 'createUser',
        input: {
          body: z
            .object({
              name: z.string(),
            })
            .optional(),
          contentType: 'application/json',
        },
      },
      req,
      Promise.resolve({}),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.body).toBeUndefined();
    }
  });
});
