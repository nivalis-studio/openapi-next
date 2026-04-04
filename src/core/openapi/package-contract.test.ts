import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('package contract', () => {
  it('publishes ESM-only exports', () => {
    const pkgPath = resolve(import.meta.dir, '../../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      exports?: Record<string, unknown>;
      main?: string;
      module?: string;
    };

    const rootExport = pkg.exports?.['.'] as Record<string, string> | undefined;

    expect(pkg.main).toBeUndefined();
    expect(pkg.module).toBeUndefined();
    expect(rootExport?.require).toBeUndefined();
    expect(rootExport?.import ?? rootExport?.default).toBeDefined();
  });

  it('uses node shebang in CLI entry', () => {
    const cliPath = resolve(import.meta.dir, '../../cli/bin.ts');
    const cli = readFileSync(cliPath, 'utf8');

    expect(cli.startsWith('#!/usr/bin/env node')).toBe(true);
  });
});
