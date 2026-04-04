import { toRoutePath } from './discovery';

export type CoverageReport = {
  warnings: Array<string>;
  skippedRoutes: Array<string>;
  orphanContracts: Array<string>;
  documentedRoutes: Array<string>;
};

const unique = (values: Array<string>): Array<string> => [...new Set(values)];

export const buildCoverageReport = ({
  appRouterPath,
  routeFiles,
  contractFiles,
}: {
  appRouterPath: string;
  routeFiles: Array<string>;
  contractFiles: Array<string>;
}): CoverageReport => {
  const routePaths = unique(
    routeFiles.map(filePath => toRoutePath(filePath, appRouterPath)),
  );
  const contractPaths = unique(
    contractFiles.map(filePath => toRoutePath(filePath, appRouterPath)),
  );

  const routePathSet = new Set(routePaths);
  const contractPathSet = new Set(contractPaths);

  const skippedRoutes = routePaths.filter(
    routePath => !contractPathSet.has(routePath),
  );
  const orphanContracts = contractPaths.filter(
    contractPath => !routePathSet.has(contractPath),
  );

  return {
    skippedRoutes,
    orphanContracts,
    documentedRoutes: contractPaths,
    warnings: [
      ...skippedRoutes.map(
        routePath =>
          `Route ${routePath} skipped from OpenAPI (no contract file).`,
      ),
      ...orphanContracts.map(
        routePath => `Contract ${routePath} has no sibling route file.`,
      ),
    ],
  };
};
