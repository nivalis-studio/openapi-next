import { existsSync } from 'node:fs';
import path from 'node:path';
import { discoverRouteFiles, toImportUrl } from './discovery';
import { generateFromRoutes } from './generate';

export const generateOpenapiSpec = async (info: {
  title: string;
  description?: string;
  version: string;
}) => {
  const appRouterPath = path.join(process.cwd(), 'src/app/api');

  if (!existsSync(appRouterPath)) {
    throw new Error('No API routes found.');
  }

  const files = discoverRouteFiles(appRouterPath);

  const routeModules = await Promise.all(
    files.map(async filePath => ({
      filePath,
      exports: (await import(toImportUrl(filePath))) as Record<string, unknown>,
    })),
  );

  return generateFromRoutes({
    info,
    routeModules,
    appRouterPath,
    outputPath: path.join(process.cwd(), 'public/openapi.json'),
  });
};
