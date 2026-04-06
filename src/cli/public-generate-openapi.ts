import { existsSync } from 'node:fs';
import path from 'node:path';
import './extension-resolver-loader';
import {
  discoverContractFiles,
  discoverRouteFiles,
  toImportUrl,
} from './discovery';
import { generateFromContracts } from './generate';
import { buildCoverageReport } from './matching';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

type OpenapiInfo = {
  title: string;
  description?: string;
  version: string;
  appDir?: string;
  output?: string;
};

export type GenerateOpenapiCoverageResult = {
  spec: OpenAPI.Document;
  coverage: ReturnType<typeof buildCoverageReport>;
};

let didRegisterExtensionResolver = false;

const toLoaderUrl = (): URL =>
  import.meta.url.endsWith('.ts')
    ? new URL('./extension-resolver-loader.ts', import.meta.url)
    : new URL('./extension-resolver-loader.js', import.meta.url);

const registerExtensionResolver = async () => {
  if (didRegisterExtensionResolver) {
    return;
  }

  try {
    const moduleNamespace = await import('node:module');
    const register =
      'register' in moduleNamespace ? moduleNamespace.register : undefined;

    if (typeof register === 'function') {
      register(toLoaderUrl(), import.meta.url);
      didRegisterExtensionResolver = true;
    }
  } catch {
    // Best effort: when register() is unavailable, fallback to native resolution.
  }
};

export const generateOpenapiSpecWithCoverage = async (
  info: OpenapiInfo,
): Promise<GenerateOpenapiCoverageResult> => {
  const appRouterPath = path.resolve(
    process.cwd(),
    info.appDir ?? 'src/app/api',
  );

  if (!existsSync(appRouterPath)) {
    throw new Error('No API routes found.');
  }

  const routeFiles = discoverRouteFiles(appRouterPath);
  const contractFiles = discoverContractFiles(appRouterPath);
  const coverage = buildCoverageReport({
    appRouterPath,
    routeFiles,
    contractFiles,
  });

  await registerExtensionResolver();

  const contractModules = await Promise.all(
    contractFiles.map(async filePath => ({
      filePath,
      exports: (await import(toImportUrl(filePath))) as Record<string, unknown>,
    })),
  );

  const spec = await generateFromContracts({
    info,
    contractModules,
    appRouterPath,
    outputPath: path.resolve(
      process.cwd(),
      info.output ?? 'public/openapi.json',
    ),
  });

  return {
    spec,
    coverage,
  };
};

export const generateOpenapiSpec = async (
  info: OpenapiInfo,
): Promise<OpenAPI.Document> => {
  const result = await generateOpenapiSpecWithCoverage(info);
  return result.spec;
};
