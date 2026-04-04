import { describe, expect, it } from 'bun:test';
import { CLI_USAGE, CliUsageError, parseCliArguments, runCli } from './index';

const createRecorder = () => {
  let output = '';

  return {
    output: () => output,
    write: (chunk: string) => {
      output += chunk;
    },
  };
};

describe('parseCliArguments', () => {
  it('returns parsed options for valid arguments', () => {
    const parsed = parseCliArguments([
      '--title',
      'Demo API',
      '--version',
      '1.2.3',
      '--description',
      'Demo description',
      '--app-dir',
      'src/app/api/internal',
      '--output',
      'public/custom-openapi.json',
      '--strict-missing-contracts',
    ]);

    expect(parsed).toEqual({
      kind: 'run',
      options: {
        title: 'Demo API',
        version: '1.2.3',
        description: 'Demo description',
        appDir: 'src/app/api/internal',
        output: 'public/custom-openapi.json',
        strictMissingContracts: true,
      },
    });
  });

  it('returns help when --help is provided', () => {
    const parsed = parseCliArguments(['--help']);

    expect(parsed).toEqual({ kind: 'help' });
  });

  it('throws for unknown arguments', () => {
    expect(() => parseCliArguments(['--x'])).toThrow(
      new CliUsageError('Unknown argument: --x.'),
    );
  });

  it('throws when required flag value is missing', () => {
    expect(() => parseCliArguments(['--output'])).toThrow(
      new CliUsageError('Missing value for --output.'),
    );
  });
});

describe('runCli', () => {
  it('prints help and exits with 0', async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();
    let wasGenerateCalled = false;

    const exitCode = await runCli({
      argv: ['--help'],
      stdout,
      stderr,
      generate: () => {
        wasGenerateCalled = true;
        return Promise.resolve({
          spec: {
            openapi: '3.1.0',
            info: { title: 'x', version: '1' },
            paths: {},
          },
          coverage: {
            warnings: [],
            skippedRoutes: [],
            orphanContracts: [],
            documentedRoutes: [],
          },
        });
      },
    });

    expect(exitCode).toBe(0);
    expect(stdout.output()).toBe(`${CLI_USAGE}\n`);
    expect(stderr.output()).toBe('');
    expect(wasGenerateCalled).toBe(false);
  });

  it('runs with no flags using package metadata defaults', async () => {
    const calls: Array<unknown> = [];

    const exitCode = await runCli({
      argv: [],
      resolvePackageInfo: () => ({
        name: '@acme/api',
        version: '9.9.9',
        description: 'Acme API',
      }),
      generate: options => {
        calls.push(options);
        return Promise.resolve({
          spec: {
            openapi: '3.1.0',
            info: { title: 'x', version: '1' },
            paths: {},
          },
          coverage: {
            warnings: [],
            skippedRoutes: [],
            orphanContracts: [],
            documentedRoutes: [],
          },
        });
      },
    });

    expect(exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      title: '@acme/api',
      version: '9.9.9',
      description: 'Acme API',
      strictMissingContracts: false,
    });
  });

  it('falls back to hardcoded defaults when package metadata is missing', async () => {
    const calls: Array<unknown> = [];

    const exitCode = await runCli({
      argv: [],
      resolvePackageInfo: () => ({}),
      generate: options => {
        calls.push(options);
        return Promise.resolve({
          spec: {
            openapi: '3.1.0',
            info: { title: 'x', version: '1' },
            paths: {},
          },
          coverage: {
            warnings: [],
            skippedRoutes: [],
            orphanContracts: [],
            documentedRoutes: [],
          },
        });
      },
    });

    expect(exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      title: 'API',
      version: '0.1.0',
      description: '',
      strictMissingContracts: false,
    });
  });

  it('returns 1 in strict mode when missing-contract warnings are present', async () => {
    const stderr = createRecorder();

    const exitCode = await runCli({
      argv: ['--strict-missing-contracts'],
      stderr,
      resolvePackageInfo: () => ({
        name: '@acme/api',
        version: '9.9.9',
      }),
      generate: () =>
        Promise.resolve({
          spec: {
            openapi: '3.1.0',
            info: { title: 'x', version: '1' },
            paths: {},
          },
          coverage: {
            warnings: [
              'Route /health skipped from OpenAPI (no contract file).',
            ],
            skippedRoutes: ['/health'],
            orphanContracts: [],
            documentedRoutes: ['/users'],
          },
        }),
    });

    expect(exitCode).toBe(1);
    expect(stderr.output()).toContain('strict-missing-contracts');
  });

  it('does not fail strict mode for orphan-contract warnings only', async () => {
    const stderr = createRecorder();

    const exitCode = await runCli({
      argv: ['--strict-missing-contracts'],
      stderr,
      resolvePackageInfo: () => ({
        name: '@acme/api',
        version: '9.9.9',
      }),
      generate: () =>
        Promise.resolve({
          spec: {
            openapi: '3.1.0',
            info: { title: 'x', version: '1' },
            paths: {},
          },
          coverage: {
            warnings: ['Contract /legacy has no sibling route file.'],
            skippedRoutes: [],
            orphanContracts: ['/legacy'],
            documentedRoutes: ['/legacy'],
          },
        }),
    });

    expect(exitCode).toBe(0);
  });

  it('returns 1 and prints stderr when generation fails', async () => {
    const stderr = createRecorder();

    const exitCode = await runCli({
      argv: [],
      stderr,
      resolvePackageInfo: () => ({
        name: '@acme/api',
        version: '9.9.9',
      }),
      generate: () => Promise.reject(new Error('boom')),
    });

    expect(exitCode).toBe(1);
    expect(stderr.output()).toContain(
      'openapi-next: Failed to generate OpenAPI spec: boom',
    );
  });
});
