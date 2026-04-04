import { resolvePackageInfo as resolvePackageInfoInternal } from './metadata';
import { generateOpenapiSpecWithCoverage as generateOpenapiSpecInternal } from './public-generate-openapi';

// biome-ignore lint/performance/noBarrelFile: CLI entrypoint re-export
export { generateOpenapiSpec } from './public-generate-openapi';

export const CLI_USAGE = [
  'Usage: openapi-next [--title <value>] [--version <value>] [--description <value>] [--app-dir <path>] [--output <path>] [--strict-missing-contracts]',
  '',
  'Options:',
  '  --title <value>                   OpenAPI document title (optional)',
  '  --version <value>                 OpenAPI document version (optional)',
  '  --description <value>             OpenAPI document description (optional)',
  '  --app-dir <value>                 App Router API directory (default: src/app/api)',
  '  --output <value>                  OpenAPI output path (default: public/openapi.json)',
  '  --strict-missing-contracts        Exit with code 1 when routes are missing contracts',
  '  --help                            Show this help message',
].join('\n');

export type CliOptions = {
  title?: string;
  version?: string;
  description?: string;
  appDir?: string;
  output?: string;
  strictMissingContracts?: boolean;
};

type ResolvedCliOptions = {
  title: string;
  version: string;
  description: string;
  appDir?: string;
  output?: string;
  strictMissingContracts: boolean;
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

type CliGenerateResult = {
  spec: unknown;
  coverage: {
    warnings: Array<string>;
    skippedRoutes: Array<string>;
    orphanContracts: Array<string>;
    documentedRoutes: Array<string>;
  };
};

type PackageInfo = {
  name?: string;
  version?: string;
  description?: string;
};

export class CliUsageError extends Error {}

const readValue = (flag: string, value: string | undefined) => {
  if (value == null || value.startsWith('--') || value.trim().length === 0) {
    throw new CliUsageError(`Missing value for ${flag}.`);
  }

  return value;
};

export const parseCliArguments = (argv: Array<string>): ParsedCliArguments => {
  const options: CliOptions = {};

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
      case '--app-dir': {
        options.appDir = readValue('--app-dir', argv[index + 1]);
        index++;
        break;
      }
      case '--output': {
        options.output = readValue('--output', argv[index + 1]);
        index++;
        break;
      }
      case '--strict-missing-contracts': {
        options.strictMissingContracts = true;
        break;
      }
      default: {
        throw new CliUsageError(`Unknown argument: ${argument}.`);
      }
    }
  }

  return {
    kind: 'run',
    options,
  };
};

const resolveCliOptions = ({
  parsed,
  packageInfo,
}: {
  parsed: CliOptions;
  packageInfo: PackageInfo;
}): ResolvedCliOptions => ({
  title: parsed.title ?? packageInfo.name ?? 'API',
  version: parsed.version ?? packageInfo.version ?? '0.1.0',
  description: parsed.description ?? packageInfo.description ?? '',
  appDir: parsed.appDir,
  output: parsed.output,
  strictMissingContracts: parsed.strictMissingContracts ?? false,
});

export const runCli = async ({
  argv,
  stdout,
  stderr,
  generate,
  resolvePackageInfo,
}: {
  argv?: Array<string>;
  stdout?: Writable;
  stderr?: Writable;
  generate?: (options: ResolvedCliOptions) => Promise<CliGenerateResult>;
  resolvePackageInfo?: () => PackageInfo;
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
    const options = resolveCliOptions({
      parsed: parsed.options,
      packageInfo: (resolvePackageInfo ?? resolvePackageInfoInternal)(),
    });

    const result = await (generate ?? generateOpenapiSpecInternal)(options);

    for (const warning of result.coverage.warnings) {
      (stderr ?? process.stderr).write(`openapi-next: warning: ${warning}\n`);
    }

    if (
      options.strictMissingContracts &&
      result.coverage.skippedRoutes.length > 0
    ) {
      (stderr ?? process.stderr).write(
        'openapi-next: strict-missing-contracts failed due to routes missing contracts\n',
      );
      return 1;
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    (stderr ?? process.stderr).write(
      `openapi-next: Failed to generate OpenAPI spec: ${message}\n`,
    );
    return 1;
  }
};
