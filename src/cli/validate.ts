import nodePath from 'node:path';
import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import { findConfig, generateOpenApiSpec } from './utils';

// Check if the OpenAPI spec is up-to-date.
export const validate = async ({ configPath }: { configPath?: string }) => {
  const config = await findConfig({ configPath });

  if (!config) {
    return;
  }

  const spec = await generateOpenApiSpec({ config });
  const path = nodePath.join(process.cwd(), 'public', config.openApiJsonPath);

  try {
    const data = readFileSync(path);
    const openApiSpec = JSON.parse(data.toString());

    if (JSON.stringify(openApiSpec) === JSON.stringify(spec)) {
      console.info(chalk.green('OpenAPI spec up to date!'));

      return true;
    }

    console.error(
      chalk.red(
        'API spec changed is not up-to-date. Run `next-rest-framework generate` to update it.',
      ),
    );
  } catch {
    console.error(
      chalk.red(
        'No OpenAPI spec found. Run `next-rest-framework generate` to generate it.',
      ),
    );
  }

  return false;
};
