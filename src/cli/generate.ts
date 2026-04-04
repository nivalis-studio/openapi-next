import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';
import { buildDocument } from '../core/openapi/build-document';
import { toRoutePath } from './discovery';
import type { HttpMethod, RouteContract } from '../core/contract';

const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);

const isRouteContract = (value: unknown): value is RouteContract => {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  if (!('method' in value)) {
    return false;
  }

  if (!('operationId' in value)) {
    return false;
  }

  if (!('responses' in value)) {
    return false;
  }

  if (typeof value.operationId !== 'string') {
    return false;
  }

  return HTTP_METHODS.has(value.method as HttpMethod);
};

export const generateFromContracts = async ({
  info,
  contractModules,
  appRouterPath,
  outputPath,
}: {
  info: { title: string; description?: string; version: string };
  contractModules: Array<{
    filePath: string;
    exports: Record<string, unknown>;
  }>;
  appRouterPath?: string;
  outputPath?: string;
}) => {
  const basePath = appRouterPath ?? path.join(process.cwd(), 'src/app/api');

  const routes = contractModules.flatMap(contractModule =>
    Object.values(contractModule.exports).flatMap(exportValue =>
      isRouteContract(exportValue)
        ? [
            {
              routePath: toRoutePath(contractModule.filePath, basePath),
              route: exportValue,
            },
          ]
        : [],
    ),
  );

  const spec = buildDocument({
    info: {
      title: info.title,
      description: info.description ?? '',
      version: info.version,
    },
    routes,
  });

  if (outputPath != null) {
    const formatted = await format(JSON.stringify(spec), { parser: 'json' });
    const absoluteOutputPath = path.resolve(outputPath);
    mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    writeFileSync(absoluteOutputPath, formatted, 'utf8');
  }

  return spec;
};
