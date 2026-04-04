#!/usr/bin/env node
/**
 * Post-build script to clean up package.json for ESM-only publishing.
 * Removes legacy fields that zshy adds but aren't needed for ESM-only packages.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkgPath = resolve(import.meta.dir, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
  module?: string;
  types?: string;
  [key: string]: unknown;
};

// Remove legacy fields for ESM-only packages
// biome-ignore lint/performance/noDelete: Required to remove fields from package.json
delete pkg.module;
// biome-ignore lint/performance/noDelete: Required to remove fields from package.json
delete pkg.types;

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, '\t')}\n`);
console.log('✓ Cleaned up package.json for ESM-only publishing');
