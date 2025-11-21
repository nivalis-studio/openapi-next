/* eslint-disable sonarjs/slow-regex */
/* eslint-disable max-statements */
/* eslint-disable no-await-in-loop */
/* eslint-disable unicorn/no-process-exit */
/* eslint-disable node/no-process-exit */

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { merge } from 'es-toolkit/compat';
import { format } from 'prettier';
import { isValidMethod } from '../utils/is-valid-method';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { ToJsonOptions } from '../lib/zod';
import type { NrfOasData, OpenApiObject } from '../types/open-api';

type RequestHandler = {
  _generateOpenApi: (
    routeName: string,
    zodToJsonOptions?: ToJsonOptions,
  ) => NrfOasData;
};

const logInfo = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const logError = (message: string) => {
  process.stderr.write(`${message}\n`);
};

const ROUTE_FILE_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'] as const;
const ROUTE_EXTENSION_PATTERN = ROUTE_FILE_EXTENSIONS.join('|');
const ROUTE_FILENAME_REGEX = new RegExp(
  `route\\.(?:${ROUTE_EXTENSION_PATTERN})$`,
);
const ROUTE_SUFFIX_REGEX = new RegExp(
  `/route\\.(?:${ROUTE_EXTENSION_PATTERN})$`,
);
const normalizeRoutePath = (file: string) => file.replace(/\\/g, '/');

const getNestedFiles = (basePath: string, dir = ''): Array<string> => {
  const dirents = readdirSync(path.join(basePath, dir), {
    withFileTypes: true,
  });

  const files = dirents.map(dirent => {
    const res = path.join(dir, dirent.name);

    return dirent.isDirectory() ? getNestedFiles(basePath, res) : res;
  });

  return files.flat();
};

const sortObjectByKeys = <T extends { [key: string]: unknown }>(obj: T): T => {
  const unordered = { ...obj };

  return Object.keys(unordered)
    .sort((a, b) => a.localeCompare(b))
    .reduce<{ [key: string]: unknown }>((acc, key) => {
      // eslint-disable-next-line no-param-reassign
      acc[key] = unordered[key];

      return acc;
    }, {}) as T;
};

const getCleanedRoutes = (files: Array<string>) =>
  files.filter(file => {
    const normalized = normalizeRoutePath(file);

    return (
      ROUTE_FILENAME_REGEX.test(normalized) && !normalized.includes('[...')
    );
  });

const getRouteName = (file: string) => {
  const normalized = normalizeRoutePath(file);

  return `/${normalized}`
    .replace(ROUTE_SUFFIX_REGEX, '')
    .replace(/\[/g, '{')
    .replace(/\]/g, '}')
    .replace(/\/?\([^)]*\)/g, '')
    .replace(/\/+/g, '/');
};

type AggregatedRouteData = {
  paths: OpenAPI.PathsObject;
  schemas: { [key: string]: OpenAPI.SchemaObject };
};

const importRouteHandlers = async (
  route: string,
  basePath: string,
): Promise<Array<RequestHandler>> => {
  const filePathToRoute = path.join(basePath, route);

  const url = new URL(`file://${filePathToRoute}`).toString();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  const res = await import(url).then(mod => mod.default || mod);

  return (
    Object.entries(res)
      .filter(([key]) => isValidMethod(key))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .map(([_key, handler]) => handler as RequestHandler)
  );
};

const aggregateRouteData = (
  handlers: Array<RequestHandler>,
  routeName: string,
  zodToJsonOptions?: ToJsonOptions,
): AggregatedRouteData =>
  handlers.reduce<AggregatedRouteData>(
    (acc, handler) => {
      try {
        const data = handler._generateOpenApi(routeName, zodToJsonOptions);

        if (isNrfOasData(data)) {
          acc.paths = { ...acc.paths, ...data.paths };
          acc.schemas = { ...acc.schemas, ...data.schemas };
        }
      } catch (error) {
        if (
          !(
            error instanceof TypeError &&
            error.message.includes('._generateOpenApi is not a function')
          )
        ) {
          logError(`${error as Error}`);
        }
      }

      return acc;
    },
    { paths: {}, schemas: {} },
  );

const isNrfOasData = (x: unknown): x is NrfOasData => {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  return 'paths' in x;
};

/**
 * Generates an OpenAPI specification from your Next.js route handlers.
 * This function scans your project for route handlers and automatically generates
 * an OpenAPI specification based on the TypeScript types and configurations.
 * @param {object} info - Configuration options for the API
 * @param {string} info.title - The title of the API
 * @param {string|undefined} info.description - A description of the API
 * @param {string} info.version - The version of the API
 * @param {object} options - Additional configuration options for OpenAPI generation
 * @param {object} options.openApiObject - An OpenAPI Object that can be used to override and extend the auto-generated specification
 * @param {object} options.zodToJsonOptions - Options to pass to the zod
 * `zodToJsonSchema`
 * @returns {Promise<object>} The generated OpenAPI specification
 */
export const generateOpenapiSpec = async (
  info: {
    title: string;
    description: string | undefined;
    version: string;
  },
  options?: {
    openApiObject?: OpenApiObject;
    zodToJsonOptions?: ToJsonOptions;
  },
  // eslint-disable-next-line sonarjs/cognitive-complexity
) => {
  const { openApiObject, zodToJsonOptions } = options ?? {};

  logInfo('Generating OpenAPI spec...');

  const appRouterPath = path.join(process.cwd(), './src/app/api/');

  if (!existsSync(appRouterPath)) {
    logInfo('No API routes found.');

    process.exit(0);
  }

  const files = getNestedFiles(appRouterPath);
  const routes = getCleanedRoutes(files);

  const aggregatedResults = await Promise.all(
    routes.map(async route => {
      const handlers = await importRouteHandlers(route, appRouterPath);

      return aggregateRouteData(
        handlers,
        getRouteName(route),
        zodToJsonOptions,
      );
    }),
  );

  const { paths, schemas } = aggregatedResults.reduce<AggregatedRouteData>(
    (acc, current) => ({
      paths: { ...acc.paths, ...current.paths },
      schemas: { ...acc.schemas, ...current.schemas },
    }),
    { paths: {}, schemas: {} },
  );

  const components =
    Object.keys(schemas).length > 0
      ? { components: { schemas: sortObjectByKeys(schemas) } }
      : {};

  const spec: OpenAPI.Document = merge(
    {
      openapi: '3.1.0',
      info: merge(info, openApiObject?.info),
      paths: sortObjectByKeys(paths),
    },
    components,
    openApiObject as OpenAPI.Document,
  );

  const publicDir = path.join(process.cwd(), 'public');
  const openApiFilePath = path.join(publicDir, 'openapi.json');

  try {
    if (existsSync(publicDir)) {
      const jsonSpec = await format(JSON.stringify(spec), {
        parser: 'json',
      });

      writeFileSync(openApiFilePath, jsonSpec, null);

      logInfo('OpenAPI spec generated successfully!');
    } else {
      logInfo(
        'The `public` folder was not found. Generating OpenAPI spec aborted.',
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : `${error}`;
    logError(`Error while generating the API spec: ${errorMessage}`);
  }
};
