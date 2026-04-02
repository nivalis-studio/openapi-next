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
    ]);

    expect(parsed).toEqual({
      kind: 'run',
      options: {
        title: 'Demo API',
        version: '1.2.3',
        description: 'Demo description',
      },
    });
  });

  it('returns help when --help is provided', () => {
    const parsed = parseCliArguments(['--help']);

    expect(parsed).toEqual({ kind: 'help' });
  });

  it('throws for missing required title', () => {
    expect(() => parseCliArguments(['--version', '1.0.0'])).toThrow(
      new CliUsageError('Missing required argument: --title.'),
    );
  });

  it('throws for missing required version', () => {
    expect(() => parseCliArguments(['--title', 'Demo API'])).toThrow(
      new CliUsageError('Missing required argument: --version.'),
    );
  });

  it('throws for unknown arguments', () => {
    expect(() =>
      parseCliArguments(['--title', 'Demo API', '--version', '1.0.0', '--x']),
    ).toThrow(new CliUsageError('Unknown argument: --x.'));
  });

  it('throws when required flag value is missing', () => {
    expect(() => parseCliArguments(['--title', '--version', '1.0.0'])).toThrow(
      new CliUsageError('Missing value for --title.'),
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
        return Promise.resolve(undefined);
      },
    });

    expect(exitCode).toBe(0);
    expect(stdout.output()).toBe(`${CLI_USAGE}\n`);
    expect(stderr.output()).toBe('');
    expect(wasGenerateCalled).toBe(false);
  });

  it('returns 0 and calls generate when args are valid', async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();
    const calls: Array<unknown> = [];

    const exitCode = await runCli({
      argv: ['--title', 'Demo API', '--version', '2.0.0'],
      stdout,
      stderr,
      generate: options => {
        calls.push(options);
        return Promise.resolve(undefined);
      },
    });

    expect(exitCode).toBe(0);
    expect(calls).toEqual([{ title: 'Demo API', version: '2.0.0' }]);
    expect(stdout.output()).toBe('');
    expect(stderr.output()).toBe('');
  });

  it('returns 1 and prints usage when parse fails', async () => {
    const stderr = createRecorder();

    const exitCode = await runCli({
      argv: ['--title', 'Demo API'],
      stderr,
      generate: () => Promise.reject(new Error('should not run')),
    });

    expect(exitCode).toBe(1);
    expect(stderr.output()).toContain('Missing required argument: --version.');
    expect(stderr.output()).toContain(CLI_USAGE);
  });

  it('returns 1 and prints stderr when generation fails', async () => {
    const stderr = createRecorder();

    const exitCode = await runCli({
      argv: ['--title', 'Demo API', '--version', '2.0.0'],
      stderr,
      generate: () => Promise.reject(new Error('boom')),
    });

    expect(exitCode).toBe(1);
    expect(stderr.output()).toContain(
      'openapi-next: Failed to generate OpenAPI spec: boom',
    );
  });
});
