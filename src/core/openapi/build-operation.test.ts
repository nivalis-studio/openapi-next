import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { buildOperation } from './build-operation';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

describe('buildOperation', () => {
  it('merges multiple content types under the same status', () => {
    const operation = buildOperation({
      routePath: '/reports',
      route: {
        method: 'GET',
        operationId: 'getReport',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': { schema: z.object({ ok: z.boolean() }) },
              'text/csv': { schema: z.string() },
            },
          },
        },
        handler: async () => ({
          status: 200,
          contentType: 'application/json',
          body: { ok: true },
        }),
      },
    });

    const responses = operation.responses as OpenAPI.ResponsesObject;
    const okResponse = responses['200'] as OpenAPI.ResponseObject;

    expect(okResponse.content?.['application/json']).toBeDefined();
    expect(okResponse.content?.['text/csv']).toBeDefined();
  });

  it('forwards zodToJsonOptions to response schema conversion', () => {
    const sharedSchema = z.object({ value: z.string() });

    const operation = buildOperation({
      routePath: '/reports',
      route: {
        method: 'GET',
        operationId: 'getReport',
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
      },
      zodToJsonOptions: {
        reused: 'inline',
      },
    });

    const schema = (
      (operation.responses as OpenAPI.ResponsesObject)[
        '200'
      ] as OpenAPI.ResponseObject
    ).content?.['application/json']?.schema as OpenAPI.SchemaObject & {
      $defs?: unknown;
    };

    expect(schema.$defs).toBeUndefined();
    expect((schema.properties?.first as OpenAPI.SchemaObject).type).toBe(
      'object',
    );
  });

  it('includes query and only templated path parameters with OpenAPI required rules', () => {
    const operation = buildOperation({
      routePath: '/reports/{reportId}',
      route: {
        method: 'GET',
        operationId: 'getReport',
        input: {
          query: z.object({
            page: z.number(),
            search: z.string().optional(),
          }),
          params: z.object({
            reportId: z.string(),
            tenantId: z.string().optional(),
          }),
        },
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
      },
    });

    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'page',
          in: 'query',
          required: true,
        }),
        expect.objectContaining({
          name: 'search',
          in: 'query',
          required: false,
        }),
        expect.objectContaining({
          name: 'reportId',
          in: 'path',
          required: true,
        }),
      ]),
    );

    const pathParameters = (operation.parameters ?? []).filter(
      parameter => 'in' in parameter && parameter.in === 'path',
    );

    expect(pathParameters).toEqual([
      expect.objectContaining({
        name: 'reportId',
        in: 'path',
        required: true,
      }),
    ]);
  });

  it('throws when templated route param is missing from input params schema', () => {
    const build = () =>
      buildOperation({
        routePath: '/reports/{reportId}',
        route: {
          method: 'GET',
          operationId: 'getReport',
          input: {
            params: z.object({
              tenantId: z.string(),
            }),
          },
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
        },
      });

    expect(build).toThrow('operationId: getReport');
    expect(build).toThrow('routePath: /reports/{reportId}');
    expect(build).toThrow('missingTemplateParams: reportId');
  });

  it('includes requestBody with contentType, converted schema and explicit required flag', () => {
    const explicit = buildOperation({
      routePath: '/reports',
      route: {
        method: 'POST',
        operationId: 'createReport',
        input: {
          body: z.object({ name: z.string() }),
          contentType: 'text/plain',
        },
        responses: {
          201: {
            description: 'created',
            content: {
              'application/json': { schema: z.object({ id: z.string() }) },
            },
          },
        },
        handler: async () => ({
          status: 201,
          contentType: 'application/json',
          body: { id: '1' },
        }),
      },
    });

    const explicitBody = explicit.requestBody as OpenAPI.RequestBodyObject;
    const explicitSchema = explicitBody.content?.['text/plain']
      ?.schema as OpenAPI.SchemaObject;

    expect(explicitBody).toBeDefined();
    expect(explicitBody.required).toBe(true);
    expect(explicitSchema.type).toBe('object');
    expect(explicitSchema.properties?.name).toMatchObject({ type: 'string' });

    const fallback = buildOperation({
      routePath: '/reports',
      route: {
        method: 'POST',
        operationId: 'createReportJson',
        input: {
          body: z.object({ name: z.string() }),
        },
        responses: {
          201: {
            description: 'created',
            content: {
              'application/json': { schema: z.object({ id: z.string() }) },
            },
          },
        },
        handler: async () => ({
          status: 201,
          contentType: 'application/json',
          body: { id: '1' },
        }),
      },
    });

    expect(
      (fallback.requestBody as OpenAPI.RequestBodyObject).content?.[
        'application/json'
      ],
    ).toBeDefined();

    const optional = buildOperation({
      routePath: '/reports/{reportId}',
      route: {
        method: 'PATCH',
        operationId: 'updateReport',
        input: {
          params: z.object({
            reportId: z.string(),
          }),
          body: z
            .object({
              name: z.string(),
            })
            .optional(),
        },
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': { schema: z.object({ id: z.string() }) },
            },
          },
        },
        handler: async () => ({
          status: 200,
          contentType: 'application/json',
          body: { id: '1' },
        }),
      },
    });

    expect((optional.requestBody as OpenAPI.RequestBodyObject).required).toBe(
      false,
    );
  });
});
