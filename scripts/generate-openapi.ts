import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { generateOpenapiSpec } from '../src/cli/public-generate-openapi';

const repoRoot = process.cwd();
const fixtureRoot = mkdtempSync(path.join(repoRoot, '.openapi-smoke-'));

const fixtureAppDir = path.join(fixtureRoot, 'src/app/api');
const fixtureApiDir = path.join(fixtureAppDir, 'health');
const fixtureRoutePath = path.join(fixtureApiDir, 'route.ts');
const fixtureContractPath = path.join(fixtureApiDir, 'contract.ts');

console.log('Creating fixture at:', fixtureRoot);

mkdirSync(fixtureApiDir, { recursive: true });
mkdirSync(path.join(fixtureRoot, 'node_modules'), { recursive: true });

// Symlink zod from repo to fixture
const repoZodPath = path.join(repoRoot, 'node_modules/zod');
const fixtureZodPath = path.join(fixtureRoot, 'node_modules/zod');

if (existsSync(repoZodPath)) {
  symlinkSync(repoZodPath, fixtureZodPath, 'dir');
  console.log('Symlinked zod from:', repoZodPath);
} else {
  console.error('zod not found at:', repoZodPath);
  process.exit(1);
}

writeFileSync(
  fixtureRoutePath,
  "export const GET = async () => new Response('ok');\n",
  'utf8',
);
console.log('Created route.ts');

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
console.log('Created contract.ts');

try {
  console.log('Generating OpenAPI spec...');
  console.log('App directory:', fixtureAppDir);

  // Generate spec by passing appDir explicitly
  const spec = await generateOpenapiSpec({
    title: 'OpenAPI Next Local API',
    description: 'Local contract used for codegen smoke checks',
    version: '3.0.0',
    appDir: fixtureAppDir, // Use src/app/api directory
    output: path.join(fixtureRoot, 'public/openapi.json'),
  });

  console.log('Spec generated, paths:', Object.keys(spec.paths || {}));

  const outputFile = path.join(fixtureRoot, 'public/openapi.json');
  console.log('Looking for output file at:', outputFile);

  if (!existsSync(outputFile)) {
    console.error('OpenAPI spec was not generated at:', outputFile);
    console.log('Fixture root contents:', readdirSync(fixtureRoot));
    process.exit(1);
  }

  mkdirSync(path.join(repoRoot, 'public'), { recursive: true });
  copyFileSync(outputFile, path.join(repoRoot, 'public/openapi.json'));
  console.log(
    'OpenAPI spec copied to',
    path.join(repoRoot, 'public/openapi.json'),
  );
} catch (error) {
  console.error('Error during generation:', error);
  process.exit(1);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
