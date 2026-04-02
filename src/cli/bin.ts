#!/usr/bin/env bun

import { runCli } from './index';

runCli()
  .then(code => {
    process.exitCode = code;
  })
  .catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`openapi-next: ${message}\n`);
    process.exitCode = 1;
  });
