import { describe, expect, it } from 'bun:test';
import { buildCoverageReport } from './matching';

describe('buildCoverageReport', () => {
  it('marks routes with no contracts as skipped', () => {
    const report = buildCoverageReport({
      appRouterPath: '/repo/src/app/api',
      routeFiles: ['/repo/src/app/api/users/route.ts'],
      contractFiles: [],
    });

    expect(report.skippedRoutes).toEqual(['/users']);
    expect(report.warnings).toContain(
      'Route /users skipped from OpenAPI (no contract file).',
    );
  });

  it('marks contracts with no route.ts as orphan contracts', () => {
    const report = buildCoverageReport({
      appRouterPath: '/repo/src/app/api',
      routeFiles: [],
      contractFiles: ['/repo/src/app/api/health/contract.ts'],
    });

    expect(report.orphanContracts).toEqual(['/health']);
    expect(report.warnings).toContain(
      'Contract /health has no sibling route file.',
    );
    expect(report.documentedRoutes).toEqual(['/health']);
  });

  it('treats hyphenated *.contract.ts files as contract-backed routes', () => {
    const report = buildCoverageReport({
      appRouterPath: '/repo/src/app/api',
      routeFiles: ['/repo/src/app/api/users/route.ts'],
      contractFiles: ['/repo/src/app/api/users/user-profile.contract.ts'],
    });

    expect(report.documentedRoutes).toEqual(['/users']);
    expect(report.skippedRoutes).toEqual([]);
    expect(report.orphanContracts).toEqual([]);
  });
});
