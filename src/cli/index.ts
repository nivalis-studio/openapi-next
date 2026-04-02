import { generateOpenapiSpec as generateOpenapiSpecInternal } from './public-generate-openapi';

// biome-ignore lint/performance/noBarrelFile: CLI entrypoint re-export
export { generateOpenapiSpec } from './public-generate-openapi';

export const CLI_USAGE = [
  'Usage: openapi-next --title <value> --version <value> [--description <value>]',
  '',
  'Options:',
  '  --title <value>        OpenAPI document title (required)',
  '  --version <value>      OpenAPI document version (required)',
  '  --description <value>  OpenAPI document description (optional)',
  '  --help                 Show this help message',
].join('\n');

export type CliOptions = {
  title: string;
  version: string;
  description?: string;
};

type ParsedCliArguments =
  | {
      kind: 'help';
    }
  | {
      kind: 'run';
      options: CliOptions;
    };

type Writable = {
  write: (chunk: string) => unknown;
};

export class CliUsageError extends Error {}

const readValue = (flag: string, value: string | undefined) => {
  if (value == null || value.startsWith('--') || value.trim().length === 0) {
    throw new CliUsageError(`Missing value for ${flag}.`);
  }

  return value;
};

export const parseCliArguments = (argv: Array<string>): ParsedCliArguments => {
  const options: Partial<CliOptions> = {};

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];

    switch (argument) {
      case '--help': {
        return { kind: 'help' };
      }
      case '--title': {
        options.title = readValue('--title', argv[index + 1]);
        index++;
        break;
      }
      case '--version': {
        options.version = readValue('--version', argv[index + 1]);
        index++;
        break;
      }
      case '--description': {
        options.description = readValue('--description', argv[index + 1]);
        index++;
        break;
      }
      default: {
        throw new CliUsageError(`Unknown argument: ${argument}.`);
      }
    }
  }

  if (options.title == null) {
    throw new CliUsageError('Missing required argument: --title.');
  }

  if (options.version == null) {
    throw new CliUsageError('Missing required argument: --version.');
  }

  return {
    kind: 'run',
    options: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
  };
};

export const runCli = async ({
  argv,
  stdout,
  stderr,
  generate,
}: {
  argv?: Array<string>;
  stdout?: Writable;
  stderr?: Writable;
  generate?: (options: CliOptions) => Promise<unknown>;
} = {}): Promise<number> => {
  const parsed = (() => {
    try {
      return parseCliArguments(argv ?? process.argv.slice(2));
    } catch (error) {
      if (!(error instanceof CliUsageError)) {
        throw error;
      }

      (stderr ?? process.stderr).write(
        `openapi-next: ${error.message}\n\n${CLI_USAGE}\n`,
      );
      return null;
    }
  })();

  if (parsed == null) {
    return 1;
  }

  if (parsed.kind === 'help') {
    (stdout ?? process.stdout).write(`${CLI_USAGE}\n`);
    return 0;
  }

  try {
    await (generate ?? generateOpenapiSpecInternal)(parsed.options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    (stderr ?? process.stderr).write(
      `openapi-next: Failed to generate OpenAPI spec: ${message}\n`,
    );
    return 1;
  }
};
