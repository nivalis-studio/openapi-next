import { describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { bindContract, defineContract } from '../core/define-route';
import { HTTP_STATUS } from '../lib/http';

const OK_STATUS = HTTP_STATUS.ok;

describe('next adapter', () => {
  it('executes route through bindContract', async () => {
    const contract = defineContract({
      method: 'GET',
      operationId: 'health',
      responses: {
        200: {
          description: 'ok',
          content: {
            'application/json': {
              schema: z.object({ ok: z.literal(true) }),
            },
          },
        },
      },
    });

    const GET = bindContract(contract, async () => ({
      status: 200,
      contentType: 'application/json',
      body: { ok: true as const },
    }));

    const response = await GET(
      new NextRequest('https://api.test/health', { method: 'GET' }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('passes real request and context to the bound handler', async () => {
    const contract = defineContract({
      method: 'GET',
      operationId: 'echoRequestContext',
      input: {
        params: z.object({ region: z.string() }),
        query: z.object({ ping: z.string() }),
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
    });

    const GET = bindContract(
      contract,
      ({ request, params, query }, respond) => {
        return respond.json(OK_STATUS, {
          echo: `${new URL(request.url).hostname}:${params.region}:${query.ping}`,
        });
      },
    );

    const response = await GET(
      new NextRequest('https://api.test/health?ping=ok'),
      {
        params: Promise.resolve({ region: 'eu' }),
      },
    );

    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ echo: 'api.test:eu:ok' });
  });

  it('does not expose _generateOpenApi compatibility helper', () => {
    const contract = defineContract({
      method: 'GET',
      operationId: 'health-no-meta',
      responses: {
        200: {
          description: 'ok',
          content: {
            'application/json': {
              schema: z.object({ ok: z.literal(true) }),
            },
          },
        },
      },
    });

    const GET = bindContract(contract, (_ctx, respond) =>
      respond.json(OK_STATUS, { ok: true as const }),
    );

    expect('_generateOpenApi' in GET).toBe(false);
    expect('_route' in GET).toBe(false);
  });
});
