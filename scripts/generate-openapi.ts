import {
  copyFileSync,
  existsSync,
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

// Symlink zod from repo to fixture
const repoZodPath = path.join(repoRoot, 'node_modules/zod');
const fixtureZodPath = path.join(fixtureRoot, 'node_modules/zod');

if (existsSync(repoZodPath)) {
  symlinkSync(repoZodPath, fixtureZodPath, 'dir');
} else {
  console.error('zod not found at:', repoZodPath);
  process.exit(1);
}

writeFileSync(
  fixtureRoutePath,
  "export const GET = async () => new Response('ok');\n",
  'utf8',
);

// Use a plain contract object that doesn't need imports
writeFileSync(
  fixtureContractPath,
  [
    "import { z } from 'zod';",
    '',
    'export const healthContract = {',
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
    '};',
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

  const outputFile = path.join(fixtureRoot, 'public/openapi.json');
  if (!existsSync(outputFile)) {
    console.error('OpenAPI spec was not generated at:', outputFile);
    process.exit(1);
  }

  copyFileSync(outputFile, path.join(repoRoot, 'public/openapi.json'));
  console.log(
    'OpenAPI spec generated at',
    path.join(repoRoot, 'public/openapi.json'),
  );
} finally {
  process.chdir(repoRoot);
  rmSync(fixtureRoot, { recursive: true, force: true });
}
