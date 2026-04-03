import { existsSync } from 'node:fs';
import path from 'node:path';
import { discoverContractFiles, toImportUrl } from './discovery';
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

  // Discover contract files (*.contract.ts) instead of route files
  // Contract files contain route definitions without handlers, making them
  // safe to import during build time without side effects
  const files = discoverContractFiles(appRouterPath);

  if (files.length === 0) {
    throw new Error(
      'No contract files found. Create *.contract.ts files alongside your route.ts files.',
    );
  }

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
