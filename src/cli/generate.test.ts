import { describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { defineContract } from '../core/define-route';
import { generateFromContracts } from './generate';

const createContract = () =>
  defineContract({
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
  });

describe('generateFromContracts', () => {
  it('builds a path item from plain contract exports', async () => {
    const spec = await generateFromContracts({
      info: { title: 'x', description: 'x', version: '1.0.0' },
      appRouterPath: '/tmp/app/api',
      contractModules: [
        {
          filePath: '/tmp/app/api/users/contract.ts',
          exports: {
            listUsersContract: createContract(),
          },
        },
      ],
    });

    const usersPath = spec.paths?.['/users'];

    expect(usersPath).toBeDefined();
    expect(usersPath?.get).toBeDefined();
    expect(usersPath?.get?.operationId).toBe('listUsers');
  });

  it('ignores non-contract exports', async () => {
    const spec = await generateFromContracts({
      info: { title: 'x', description: 'x', version: '1.0.0' },
      appRouterPath: '/tmp/app/api',
      contractModules: [
        {
          filePath: '/tmp/app/api/users/contract.ts',
          exports: {
            notAContract: () => 'noop',
          },
        },
      ],
    });

    expect(spec.paths).toEqual({});
  });

  it('creates parent directories for outputPath before writing the spec', async () => {
    const tempDirectory = mkdtempSync(
      path.join(tmpdir(), 'openapi-next-generate-'),
    );
    const outputPath = path.join(tempDirectory, 'nested', 'openapi.json');

    try {
      await generateFromContracts({
        info: { title: 'x', description: 'x', version: '1.0.0' },
        appRouterPath: '/tmp/app/api',
        outputPath,
        contractModules: [
          {
            filePath: '/tmp/app/api/users/contract.ts',
            exports: {
              listUsersContract: createContract(),
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
