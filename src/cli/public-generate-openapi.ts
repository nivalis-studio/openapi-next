import { existsSync } from 'node:fs';
import path from 'node:path';
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
