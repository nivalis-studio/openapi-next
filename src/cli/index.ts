#!/usr/bin/env node
/* eslint-disable node/no-process-exit */

import { Command } from 'commander';
import chalk from 'chalk';
import { generate } from './generate';
import { validate } from './validate';

const program = new Command();

program
  .command('generate')
  .option(
    '--configPath <string>',
    'In case you have multiple docs handlers with different configurations, you can specify which configuration you want to use by providing the path to the API. Example: `/api/my-configuration`.',
  )
  .description('Generate an OpenAPI spec with openapi-next.')
  .action(async options => {
    const configPath: string = options.configPath ?? '';

    try {
      console.info(chalk.yellowBright('Generating OpenAPI spec...'));

      await generate({
        configPath,
      });
    } catch (error) {
      console.error(error);

      process.exit(1);
    }
  });

program
  .command('validate')
  .option(
    '--configPath <string>',
    'In case you have multiple docs handlers with different configurations, you can specify which configuration you want to use by providing the path to the API. Example: `/api/my-configuration`.',
  )
  .description('Validate an OpenAPI spec with openapi-next.')
  .action(async options => {
    const configPath: string = options.configPath ?? '';

    try {
      console.info(chalk.yellowBright('Validating OpenAPI spec...'));

      const valid = await validate({
        configPath,
      });

      if (!valid) {
        process.exit(1);
      }
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });

program.parse(process.argv);
