import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { bindContract, defineRouteContract } from '../core/define-route';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

const OK_STATUS = 200;

describe('next adapter', () => {
  it('executes route through bindContract', async () => {
    const contract = defineRouteContract({
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
      new Request('https://api.test/health', { method: 'GET' }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('passes real request and context to the bound handler', async () => {
    const contract = defineRouteContract({
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
        return respond.json(200, {
          echo: `${new URL(request.url).hostname}:${params.region}:${query.ping}`,
        });
      },
    );

    const response = await GET(new Request('https://api.test/health?ping=ok'), {
      params: Promise.resolve({ region: 'eu' }),
    });

    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ echo: 'api.test:eu:ok' });
  });

  it('exposes _generateOpenApi compatibility helper on the handler', () => {
    const contract = defineRouteContract({
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

    expect(typeof GET._generateOpenApi).toBe('function');

    const openApiData = GET._generateOpenApi('/health');

    expect(openApiData.paths).toBeDefined();
    expect(openApiData.paths?.['/health']?.get).toBeDefined();
  });

  it('forwards zodToJsonOptions through _generateOpenApi compatibility helper', () => {
    const sharedSchema = z.object({ value: z.string() });

    const contract = defineRouteContract({
      method: 'GET',
      operationId: 'health',
      responses: {
        200: {
          description: 'ok',
          content: {
            'application/json': {
              schema: z.object({
                first: sharedSchema,
                second: sharedSchema,
              }),
            },
          },
        },
      },
    });

    const GET = bindContract(contract, async () => ({
      status: 200,
      contentType: 'application/json',
      body: {
        first: { value: 'a' },
        second: { value: 'b' },
      },
    }));

    const openApiData = GET._generateOpenApi('/health', {
      reused: 'inline',
    });

    const response = openApiData.paths?.['/health']?.get?.responses?.[
      '200'
    ] as OpenAPI.ResponseObject;

    const schema = response.content?.['application/json']?.schema as {
      $defs?: unknown;
    };

    expect(schema.$defs).toBeUndefined();
  });
});
