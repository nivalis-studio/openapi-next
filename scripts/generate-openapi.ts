import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { generateOpenapiSpec } from '../src/cli/public-generate-openapi';

const repoRoot = process.cwd();
const fixtureRoot = mkdtempSync(path.join(repoRoot, '.openapi-smoke-'));

const fixtureRoutePath = path.join(fixtureRoot, 'src/app/api/health/route.ts');

const fixtureRouteContents = `import { z } from 'zod';

const GET = Object.assign(async () => new Response('ok'), {
  _route: {
    method: 'GET' as const,
    operationId: 'openapiSmokeHealthCheck',
    responses: {
      200: {
        description: 'Smoke check response',
        content: {
          'application/json': {
            schema: z.object({ healthy: z.literal(true) }),
          },
        },
      },
    },
    handler: () => ({
      status: 200,
      contentType: 'application/json',
      body: { healthy: true },
    }),
  },
});

export { GET };
`;

mkdirSync(path.dirname(fixtureRoutePath), { recursive: true });
writeFileSync(fixtureRoutePath, fixtureRouteContents, 'utf8');

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
