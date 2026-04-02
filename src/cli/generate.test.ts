import { describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { generateFromRoutes } from './generate';

const createRouteDefinition = () => ({
  method: 'GET' as const,
  operationId: 'listUsers',
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
  handler: () => ({
    status: 200,
    contentType: 'application/json',
    body: { success: true },
  }),
});

describe('generateFromRoutes', () => {
  it('throws when route export is missing normalized metadata', async () => {
    await expect(
      generateFromRoutes({
        info: { title: 'x', description: 'x', version: '1.0.0' },
        appRouterPath: '/tmp/app/api',
        routeModules: [
          {
            filePath: '/tmp/route.ts',
            exports: {
              GET: async () => new Response('ok'),
            },
          },
        ],
      }),
    ).rejects.toThrow('Route export missing _route metadata');
  });

  it('builds a path item from function exports with route metadata', async () => {
    const routeDefinition = createRouteDefinition();
    const nextHandler = Object.assign(async () => new Response('ok'), {
      _route: routeDefinition,
    });

    const spec = await generateFromRoutes({
      info: { title: 'x', description: 'x', version: '1.0.0' },
      appRouterPath: '/tmp/app/api',
      routeModules: [
        {
          filePath: '/tmp/app/api/users/route.ts',
          exports: {
            GET: nextHandler,
          },
        },
      ],
    });

    const usersPath = spec.paths?.['/users'];

    expect(usersPath).toBeDefined();
    expect(usersPath?.get).toBeDefined();
    expect(usersPath?.get?.operationId).toBe('listUsers');
  });

  it('throws when export method does not match _route.method', async () => {
    const postRouteDefinition = {
      ...createRouteDefinition(),
      method: 'POST' as const,
    };

    await expect(
      generateFromRoutes({
        info: { title: 'x', description: 'x', version: '1.0.0' },
        appRouterPath: '/tmp/app/api',
        routeModules: [
          {
            filePath: '/tmp/app/api/users/route.ts',
            exports: {
              GET: {
                _route: postRouteDefinition,
              },
            },
          },
        ],
      }),
    ).rejects.toThrow(
      'Route export method mismatch: /tmp/app/api/users/route.ts (export: GET, _route.method: POST)',
    );
  });

  it('creates parent directories for outputPath before writing the spec', async () => {
    const tempDirectory = mkdtempSync(
      path.join(tmpdir(), 'openapi-next-generate-'),
    );
    const outputPath = path.join(tempDirectory, 'nested', 'openapi.json');

    try {
      await generateFromRoutes({
        info: { title: 'x', description: 'x', version: '1.0.0' },
        appRouterPath: '/tmp/app/api',
        outputPath,
        routeModules: [
          {
            filePath: '/tmp/app/api/users/route.ts',
            exports: {
              GET: {
                _route: createRouteDefinition(),
              },
            },
          },
        ],
      });

      expect(existsSync(outputPath)).toBe(true);
      const parsedSpec = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        paths: { '/users': { get: { operationId: string } } };
      };
      expect(parsedSpec.paths['/users'].get.operationId).toBe('listUsers');
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
