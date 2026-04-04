import { describe, expect, it } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateOpenapiSpecWithCoverage } from './public-generate-openapi';

describe('generateOpenapiSpec', () => {
  it('generates from contract exports and reports skipped route warnings', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'openapi-next-public-'));
    const previousCwd = process.cwd();
    const usersDir = path.join(tempRoot, 'src/app/api/users');
    const healthDir = path.join(tempRoot, 'src/app/api/health');

    mkdirSync(usersDir, { recursive: true });
    mkdirSync(healthDir, { recursive: true });
    mkdirSync(path.join(tempRoot, 'node_modules'), { recursive: true });
    symlinkSync(
      path.join(previousCwd, 'node_modules/zod'),
      path.join(tempRoot, 'node_modules/zod'),
      'dir',
    );

    writeFileSync(
      path.join(usersDir, 'route.ts'),
      'export const GET = async () => new Response("ok");',
    );
    writeFileSync(
      path.join(healthDir, 'route.ts'),
      'export const GET = async () => new Response("ok");',
    );
    writeFileSync(
      path.join(usersDir, 'contract.ts'),
      [
        "import { z } from 'zod';",
        'export const usersContract = {',
        "  method: 'GET',",
        "  operationId: 'listUsers',",
        '  responses: {',
        '    200: {',
        "      description: 'ok',",
        '      content: {',
        "        'application/json': { schema: z.object({ ok: z.boolean() }) },",
        '      },',
        '    },',
        '  },',
        '};',
      ].join('\n'),
      'utf8',
    );

    try {
      process.chdir(tempRoot);

      const result = await generateOpenapiSpecWithCoverage({
        title: 'x',
        version: '1.0.0',
      });

      expect(result.spec.paths?.['/users']?.get?.operationId).toBe('listUsers');
      expect(result.coverage.skippedRoutes).toEqual(['/health']);
    } finally {
      process.chdir(previousCwd);
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('accepts absolute app-dir and output paths', async () => {
    const tempRoot = mkdtempSync(
      path.join(tmpdir(), 'openapi-next-public-abs-'),
    );
    const previousCwd = process.cwd();
    const appDir = path.join(tempRoot, 'src/app/api');
    const usersDir = path.join(appDir, 'users');
    const outputPath = path.join(tempRoot, 'artifacts/openapi.json');

    mkdirSync(usersDir, { recursive: true });
    mkdirSync(path.join(tempRoot, 'node_modules'), { recursive: true });
    symlinkSync(
      path.join(previousCwd, 'node_modules/zod'),
      path.join(tempRoot, 'node_modules/zod'),
      'dir',
    );

    writeFileSync(
      path.join(usersDir, 'route.ts'),
      'export const GET = async () => new Response("ok");',
    );
    writeFileSync(
      path.join(usersDir, 'contract.ts'),
      [
        "import { z } from 'zod';",
        'export const usersContract = {',
        "  method: 'GET',",
        "  operationId: 'listUsersAbsolutePaths',",
        '  responses: {',
        '    200: {',
        "      description: 'ok',",
        '      content: {',
        "        'application/json': { schema: z.object({ ok: z.boolean() }) },",
        '      },',
        '    },',
        '  },',
        '};',
      ].join('\n'),
      'utf8',
    );

    try {
      process.chdir(previousCwd);

      await generateOpenapiSpecWithCoverage({
        title: 'x',
        version: '1.0.0',
        appDir,
        output: outputPath,
      });

      expect(existsSync(outputPath)).toBe(true);
      const parsed = JSON.parse(readFileSync(outputPath, 'utf8')) as {
        paths: Record<string, { get?: { operationId?: string } }>;
      };
      expect(parsed.paths['/users']?.get?.operationId).toBe(
        'listUsersAbsolutePaths',
      );
    } finally {
      process.chdir(previousCwd);
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
