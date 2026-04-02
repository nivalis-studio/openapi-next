import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $ } from 'bun';

const tempDir = mkdtempSync(path.join(tmpdir(), 'openapi-codegen-smoke-'));
const outputDir = path.join(tempDir, 'client');
const outputEntry = path.join(outputDir, 'index.ts');
const openApiJsonPath = path.join(process.cwd(), 'public/openapi.json');
const smokeTsconfigPath = path.join(tempDir, 'tsconfig.smoke.json');

try {
  await $`bunx openapi-ts --input ${openApiJsonPath} --output ${outputDir}`;
  writeFileSync(
    smokeTsconfigPath,
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          noEmit: true,
          skipLibCheck: true,
        },
        files: [outputEntry],
      },
      null,
      2,
    ),
  );
  await $`bunx tsc --project ${smokeTsconfigPath}`;
} finally {
  rmSync(openApiJsonPath, { force: true });
  rmSync(tempDir, { recursive: true, force: true });
}
