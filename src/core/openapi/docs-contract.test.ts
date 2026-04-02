import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testFileDir = dirname(fileURLToPath(import.meta.url));
const readmePath = resolve(testFileDir, '../../../README.md');

describe('docs contract', () => {
  it('README no longer references fluent v2 chain API', () => {
    const readme = readFileSync(readmePath, 'utf8');

    expect(readme.includes('.outputs(')).toBe(false);
    expect(readme.includes('.input(')).toBe(false);
    expect(readme.includes('defineRoute(')).toBe(true);
  });
});
