import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { generateOpenapiSpec } from '../src/cli/public-generate-openapi';

const repoRoot = process.cwd();
const fixtureRoot = mkdtempSync(path.join(repoRoot, '.openapi-smoke-'));

const fixtureApiDir = path.join(fixtureRoot, 'src/app/api/health');
const fixtureRoutePath = path.join(fixtureApiDir, 'route.ts');
const fixtureContractPath = path.join(fixtureApiDir, 'contract.ts');

mkdirSync(fixtureApiDir, { recursive: true });
mkdirSync(path.join(fixtureRoot, 'node_modules'), { recursive: true });
symlinkSync(
  path.join(repoRoot, 'node_modules/zod'),
  path.join(fixtureRoot, 'node_modules/zod'),
  'dir',
);

writeFileSync(
  fixtureRoutePath,
  "export const GET = async () => new Response('ok');\n",
  'utf8',
);

writeFileSync(
  fixtureContractPath,
  [
    `import { defineRouteContract } from '${path.join(repoRoot, 'src/core/define-route.ts')}';`,
    "import { z } from 'zod';",
    '',
    'export const healthContract = defineRouteContract({',
    "  method: 'GET',",
    "  operationId: 'openapiSmokeHealthCheck',",
    '  responses: {',
    '    200: {',
    "      description: 'Smoke check response',",
    '      content: {',
    "        'application/json': {",
    '          schema: z.object({ healthy: z.literal(true) }),',
    '        },',
    '      },',
    '    },',
    '  },',
    '});',
    '',
  ].join('\n'),
  'utf8',
);

try {
  process.chdir(fixtureRoot);

  await generateOpenapiSpec({
    title: 'OpenAPI Next Local API',
    description: 'Local contract used for codegen smoke checks',
    version: '3.0.0',
  });

  copyFileSync(
    path.join(fixtureRoot, 'public/openapi.json'),
    path.join(repoRoot, 'public/openapi.json'),
  );
} finally {
  process.chdir(repoRoot);
  rmSync(fixtureRoot, { recursive: true, force: true });
}
