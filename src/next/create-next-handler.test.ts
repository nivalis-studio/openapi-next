import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { defineRoute } from '../core/define-route';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

const OK_STATUS = 200;

describe('next adapter', () => {
  it('executes route through defineRoute.next', async () => {
    const route = defineRoute({
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
      handler: async () => ({
        status: 200,
        contentType: 'application/json',
        body: { ok: true },
      }),
    });

    const response = await route.next(
      new Request('https://api.test/health', { method: 'GET' }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(OK_STATUS);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('exposes _generateOpenApi compatibility helper on the handler', () => {
    const route = defineRoute({
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
      handler: async () => ({
        status: 200,
        contentType: 'application/json',
        body: { ok: true },
      }),
    });

    expect(typeof route.next._generateOpenApi).toBe('function');

    const openApiData = route.next._generateOpenApi('/health');

    expect(openApiData.paths).toBeDefined();
    expect(openApiData.paths?.['/health']?.get).toBeDefined();
  });

  it('forwards zodToJsonOptions through _generateOpenApi compatibility helper', () => {
    const sharedSchema = z.object({ value: z.string() });

    const route = defineRoute({
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
      handler: async () => ({
        status: 200,
        contentType: 'application/json',
        body: { ok: true },
      }),
    });

    const openApiData = route.next._generateOpenApi('/health', {
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
