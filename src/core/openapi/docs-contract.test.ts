import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testFileDir = dirname(fileURLToPath(import.meta.url));
const readmePath = resolve(testFileDir, '../../../README.md');
const migrationPath = resolve(testFileDir, '../../../docs/migrations/v3.md');

describe('docs contract', () => {
  it('README references contract-first binder API', () => {
    const readme = readFileSync(readmePath, 'utf8');

    expect(readme.includes('.outputs(')).toBe(false);
    expect(readme.includes('.input(')).toBe(false);
    expect(readme.includes('bindContract(')).toBe(true);
    expect(readme.includes('defineRouteContract(')).toBe(true);
    expect(readme.includes('defineRoute(')).toBe(false);
  });

  it('migration guide references contract-first v3 flow', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration.includes('defineRouteContract(')).toBe(true);
    expect(migration.includes('bindContract(')).toBe(true);
    expect(migration.includes('getOpenapiOutputs')).toBe(false);
    expect(migration.includes('route({')).toBe(false);
  });
});
