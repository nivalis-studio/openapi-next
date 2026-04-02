import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { defineRoute } from './define-route';

const OK_STATUS = 200;

describe('defineRoute', () => {
  it('returns route metadata and executes the route handler', async () => {
    const route = defineRoute({
      method: 'GET',
      operationId: 'listUsers',
      input: {
        query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
      },
      responses: {
        200: {
          description: 'ok',
          content: {
            'application/json': {
              schema: z.object({ success: z.literal(true) }),
            },
          },
        },
      },
      handler: async () => ({
        status: 200,
        contentType: 'application/json',
        body: { success: true },
      }),
    });

    expect(typeof route.next).toBe('function');
    expect(route._route.operationId).toBe('listUsers');
    expect(route._route.method).toBe('GET');

    const response = await route.next(
      new Request('https://example.com/users'),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(OK_STATUS);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
