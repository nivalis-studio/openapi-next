import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { buildDocument } from './build-document';

describe('buildDocument', () => {
  it('throws when operationId is duplicated', () => {
    const route = {
      method: 'GET' as const,
      operationId: 'dup',
      responses: {
        200: {
          description: 'ok',
          content: {
            'application/json': { schema: z.object({ ok: z.boolean() }) },
          },
        },
      },
      handler: async () => ({
        status: 200,
        contentType: 'application/json',
        body: { ok: true },
      }),
    };

    expect(() =>
      buildDocument({
        info: { title: 'x', version: '1.0.0', description: 'x' },
        routes: [
          { routePath: '/a', route },
          { routePath: '/b', route },
        ],
      }),
    ).toThrow('DUPLICATE_OPERATION_ID');
  });

  it('throws when routePath and method are duplicated', () => {
    const getRoute = {
      method: 'GET' as const,
      operationId: 'getA',
      responses: {
        200: {
          description: 'ok',
          content: {
            'application/json': { schema: z.object({ ok: z.boolean() }) },
          },
        },
      },
      handler: async () => ({
        status: 200,
        contentType: 'application/json',
        body: { ok: true },
      }),
    };

    const secondGetRoute = {
      ...getRoute,
      operationId: 'getB',
    };

    expect(() =>
      buildDocument({
        info: { title: 'x', version: '1.0.0', description: 'x' },
        routes: [
          { routePath: '/same', route: getRoute },
          { routePath: '/same', route: secondGetRoute },
        ],
      }),
    ).toThrow('DUPLICATE_PATH_METHOD');
  });
});
