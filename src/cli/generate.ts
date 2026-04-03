import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format } from 'prettier';
import { buildDocument } from '../core/openapi/build-document';
import { toRoutePath } from './discovery';
import type { HttpMethod, RouteDefinition } from '../core/contract';

const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);

const isRouteExport = (
  value: unknown,
): value is { _route: RouteDefinition } => {
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null
  ) {
    return false;
  }

  return '_route' in value;
};

export const generateFromRoutes = async ({
  info,
  routeModules,
  appRouterPath,
  outputPath,
}: {
  info: { title: string; description?: string; version: string };
  routeModules: Array<{ filePath: string; exports: Record<string, unknown> }>;
  appRouterPath?: string;
  outputPath?: string;
}) => {
  const basePath = appRouterPath ?? path.join(process.cwd(), 'src/app/api');

  const routes = routeModules.flatMap(routeModule =>
    Object.entries(routeModule.exports).flatMap(([exportName, exportValue]) => {
      if (!HTTP_METHODS.has(exportName as HttpMethod)) {
        return [];
      }

      if (!isRouteExport(exportValue)) {
        // Skip routes that don't have _route metadata (e.g., routes from external libraries like better-auth)
        return [];
      }

      if (exportValue._route.method !== exportName) {
        throw new Error(
          `Route export method mismatch: ${routeModule.filePath} (export: ${exportName}, _route.method: ${exportValue._route.method})`,
        );
      }

      return [
        {
          routePath: toRoutePath(routeModule.filePath, basePath),
          route: exportValue._route,
        },
      ];
    }),
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
