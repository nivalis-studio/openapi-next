import { readdirSync } from 'node:fs';
import path, { sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROUTE_FILE_PATTERN = /route\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ROUTE_SUFFIX_PATTERN = /\/route\.(ts|tsx|js|jsx|mjs|cjs)$/;
const CONTRACT_SUFFIX_PATTERN = /\/(\w+\.)?contract\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ROUTE_GROUP_SEGMENT_PATTERN = /\/?\([^)]*\)/g;

// Pattern for contract files (contract.ts or *.contract.ts)
const CONTRACT_FILE_PATTERN = /(^|\.)contract\.(ts|tsx|js|jsx|mjs|cjs)$/;

export const discoverRouteFiles = (basePath: string): Array<string> => {
  const walk = (dir: string): Array<string> =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const fullPath = path.join(dir, entry.name);

      return entry.isDirectory() ? walk(fullPath) : [fullPath];
    });

  return walk(basePath).filter(filePath => ROUTE_FILE_PATTERN.test(filePath));
};

/**
 * Discovers contract files (contract.ts or *.contract.ts) for OpenAPI generation.
 * These files contain route definitions without handlers, making them
 * safe to import during build time without side effects.
 */
export const discoverContractFiles = (basePath: string): Array<string> => {
  const walk = (dir: string): Array<string> =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const fullPath = path.join(dir, entry.name);

      return entry.isDirectory() ? walk(fullPath) : [fullPath];
    });

  return walk(basePath).filter(filePath =>
    CONTRACT_FILE_PATTERN.test(path.basename(filePath)),
  );
};

export const toImportUrl = (filePath: string): string =>
  pathToFileURL(filePath).href;

export const toRoutePath = (
  filePath: string,
  appRouterPath: string,
): string => {
  const normalizedFilePath = path.normalize(filePath);
  const normalizedAppRouterPath = path.normalize(appRouterPath);
  const relativePath = path.relative(
    normalizedAppRouterPath,
    normalizedFilePath,
  );

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Route file is outside app router path: ${filePath}`);
  }

  const routePath = `/${relativePath}`
    .split(sep)
    .join('/')
    .replace(ROUTE_SUFFIX_PATTERN, '')
    .replace(CONTRACT_SUFFIX_PATTERN, '')
    .replace(/\[/g, '{')
    .replace(/\]/g, '}')
    .replace(ROUTE_GROUP_SEGMENT_PATTERN, '')
    .replace(/\/+/g, '/');

  return routePath === '' ? '/' : routePath;
};
