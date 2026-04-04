import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  discoverContractFiles,
  discoverRouteFiles,
  toRoutePath,
} from './discovery';

describe('discovery', () => {
  it('discovers route and contract files with supported naming', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'openapi-next-discovery-'));
    const apiRoot = path.join(root, 'src/app/api');

    try {
      const usersDir = path.join(apiRoot, 'users');
      const healthDir = path.join(apiRoot, 'health');
      mkdirSync(usersDir, { recursive: true });
      mkdirSync(healthDir, { recursive: true });

      writeFileSync(
        path.join(usersDir, 'route.ts'),
        'export const GET = () => {}',
      );
      writeFileSync(
        path.join(usersDir, 'contract.ts'),
        'export const users = {}',
      );
      writeFileSync(
        path.join(usersDir, 'user-profile.contract.ts'),
        'export const usersProfile = {}',
      );
      writeFileSync(
        path.join(healthDir, 'health.contract.ts'),
        'export const health = {}',
      );
      writeFileSync(path.join(apiRoot, 'ignore-me.ts'), 'export {}');

      expect(discoverRouteFiles(apiRoot)).toEqual([
        path.join(usersDir, 'route.ts'),
      ]);

      expect(discoverContractFiles(apiRoot).sort()).toEqual(
        [
          path.join(usersDir, 'contract.ts'),
          path.join(usersDir, 'user-profile.contract.ts'),
          path.join(healthDir, 'health.contract.ts'),
        ].sort(),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps route.ts and contract.ts files to the same route path', () => {
    const appRouterPath = '/repo/src/app/api';

    expect(toRoutePath('/repo/src/app/api/users/route.ts', appRouterPath)).toBe(
      '/users',
    );

    expect(
      toRoutePath('/repo/src/app/api/users/contract.ts', appRouterPath),
    ).toBe('/users');

    expect(
      toRoutePath('/repo/src/app/api/users/users.contract.ts', appRouterPath),
    ).toBe('/users');

    expect(
      toRoutePath(
        '/repo/src/app/api/users/user-profile.contract.ts',
        appRouterPath,
      ),
    ).toBe('/users');

    expect(
      toRoutePath(
        '/repo/src/app/api/users/users.v2.contract.ts',
        appRouterPath,
      ),
    ).toBe('/users');
  });
});
