import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import chalk from 'chalk';
// eslint-disable-next-line no-restricted-syntax
import * as prettier from 'prettier';
import { findConfig, generateOpenApiSpec } from './utils';

const writeOpenApiSpec = async ({
  path,
  spec,
}: {
  path: string;
  spec: { [key: string]: unknown };
}) => {
  try {
    if (!existsSync(nodePath.join(process.cwd(), 'public'))) {
      console.info(
        chalk.redBright(
          'The `public` folder was not found. Generating OpenAPI spec aborted.',
        ),
      );

      return;
    }

    const jsonSpec = await prettier.format(JSON.stringify(spec), {
      parser: 'json',
    });

    writeFileSync(path, jsonSpec, null);
    console.info(chalk.green('OpenAPI spec generated successfully!'));
  } catch (error) {
    console.error(chalk.red(`Error while generating the API spec: ${error}`));
  }
};

// Regenerate the OpenAPI spec if it has changed.
export const generate = async ({ configPath }: { configPath?: string }) => {
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
      console.info(
        chalk.green('OpenAPI spec up to date, skipping generation.'),
      );
    } else {
      console.info(
        chalk.yellowBright(
          'OpenAPI spec changed, regenerating `openapi.json`...',
        ),
      );

      await writeOpenApiSpec({ path, spec });
    }
  } catch {
    console.info(
      chalk.yellowBright('No OpenAPI spec found, generating `openapi.json`...'),
    );

    await writeOpenApiSpec({ path, spec });
  }
};
