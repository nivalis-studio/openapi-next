import { describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { HTTP_STATUS } from '../lib/http';
import { bindContract, defineContract } from './define-route';

const OK_STATUS = HTTP_STATUS.ok;

describe('bindContract', () => {
  it('binds a contract to a Next-style handler', async () => {
    const contract = defineContract({
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

    const GET = bindContract(contract, async ({ query }, respond) =>
      respond.json(OK_STATUS, { success: query.page >= 1 }),
    );

    expect(typeof GET).toBe('function');

    const response = await GET(
      new NextRequest('https://example.com/users?page=1'),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(OK_STATUS);
    expect(response.json()).resolves.toEqual({ success: true });
  });
});
