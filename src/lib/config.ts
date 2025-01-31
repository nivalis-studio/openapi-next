import { merge } from 'es-toolkit/compat';
import type { FrameworkConfig } from '../types/config';

const DEFAULT_TITLE = 'REST API';
const DEFAULT_DESCRIPTION = 'REST API Documentation';

// Ignore: We don't want to use promises here to avoid making this an async function.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, unicorn/prefer-module
export const VERSION = require('../../package.json').version;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, unicorn/prefer-module
export const HOMEPAGE = require('../../package.json').homepage;

export const DEFAULT_CONFIG: Required<FrameworkConfig> = {
  deniedPaths: [],
  allowedPaths: ['**'],
  openApiObject: {
    info: {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      version: `v${VERSION}`,
    },
  },
  openApiJsonPath: '/openapi.json',
  docsConfig: {
    provider: 'redoc',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    faviconUrl: '',
    logoUrl: '',
    ogConfig: {
      title: DEFAULT_TITLE,
      type: 'website',
      url: HOMEPAGE,
      imageUrl: '',
    },
  },
};

export const getConfig = (config?: FrameworkConfig) =>
  merge({}, DEFAULT_CONFIG, config);
