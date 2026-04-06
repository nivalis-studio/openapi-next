import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testFileDir = dirname(fileURLToPath(import.meta.url));
const readmePath = resolve(testFileDir, '../../../README.md');

describe('docs contract', () => {
  it('README references contract-first binder API', () => {
    const readme = readFileSync(readmePath, 'utf8');

    expect(readme.includes('.outputs(')).toBe(false);
    expect(readme.includes('.input(')).toBe(false);
    expect(readme.includes('bindContract(')).toBe(true);
    expect(readme.includes('defineContract(')).toBe(true);
    expect(readme.includes('defineRoute(')).toBe(false);
  });

  it('README uses object-context bindContract handler signature', () => {
    const readme = readFileSync(readmePath, 'utf8');

    expect(readme.includes('async (_request, _context, input)')).toBe(false);
    expect(readme.includes('async ({ query }, respond)')).toBe(true);
  });
});
