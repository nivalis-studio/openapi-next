import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { bindContract, defineRouteContract } from './define-route';

const OK_STATUS = 200;

describe('bindContract', () => {
  it('binds a contract to a Next-style handler', async () => {
    const contract = defineRouteContract({
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
              schema: z.object({ success: z.boolean() }),
            },
          },
        },
      },
    });

    const GET = bindContract(contract, async (_request, _context, input) => ({
      status: 200,
      contentType: 'application/json',
      body: { success: input.query.page >= 1 },
    }));

    expect(typeof GET).toBe('function');

    const response = await GET(
      new Request('https://example.com/users?page=1'),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(OK_STATUS);
    expect(response.json()).resolves.toEqual({ success: true });
  });
});
