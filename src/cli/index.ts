/* eslint-disable no-await-in-loop */
/* eslint-disable unicorn/no-process-exit */
/* eslint-disable node/no-process-exit */

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { merge } from 'es-toolkit/compat';
import { format } from 'prettier';
import { isValidMethod } from '../utils/is-valid-method';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { NrfOasData, OpenApiObject } from '../types/open-api';

type RequestHandler = {
  _generateOpenApi: (routeName: string) => NrfOasData;
};

/*
 * Filter routes to include:
 * - Remove any routes that are not route handlers.
 * - Remove catch-all routes.
 * - Filter RPC routes.
 * - Filter disallowed paths.
 */
const getCleanedRoutes = (files: string[]) =>
  files.filter(file => file.endsWith('route.ts') && !file.includes('[...'));

const getRouteName = (file: string) =>
  `/${file}`
    .replace('/route.ts', '')
    .replace('/route.js', '')
    .replaceAll('\\', '/')
    .replaceAll('[', '{')
    .replaceAll(']', '}')
    .replaceAll(/\/?\([^)]*\)/g, '')
    .replaceAll(/\/+/g, '/');

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
 * @param {object} config - Configuration options for the OpenAPI spec generation
 * @param {object} [config.openApiObject] - An OpenAPI Object that can be used to override and extend the auto-generated specification
 * @returns {Promise<object>} The generated OpenAPI specification
 */
export const generateOpenapiSpec = async (
  config: {
    /*! An OpenAPI Object that can be used to override and extend the auto-generated specification: https://swagger.io/specification/#openapi-object */
    openApiObject?: OpenApiObject | undefined;
  } = {},
) => {
  console.log('Generating OpenAPI spec...');
  const { openApiObject } = config;

  const appRouterPath = path.join(process.cwd(), './src/app/api/');

  if (!existsSync(appRouterPath)) {
    console.log('No API routes found.');

    process.exit(0);
  }

  const getNestedFiles = (basePath: string, dir: string): string[] => {
    const dirents = readdirSync(path.join(basePath, dir), {
      withFileTypes: true,
    });

    const files = dirents.map(dirent => {
      const res = path.join(dir, dirent.name);

      return dirent.isDirectory() ? getNestedFiles(basePath, res) : res;
    });

    return files.flat();
  };

  const files = getNestedFiles(appRouterPath, '');
  const routes = getCleanedRoutes(files);

  let paths: OpenAPI.PathsObject = {};
  let schemas: { [key: string]: OpenAPI.SchemaObject } = {};

  for (const route of routes) {
    const filePathToRoute = path.join(appRouterPath, route);

    const url = new URL(`file://${filePathToRoute}`).toString();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    const res = await import(url).then(mod => mod.default || mod);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const handlers = Object.entries(res)
      .filter(([key]) => isValidMethod(key))

      .map(([_key, handler]) => handler as RequestHandler);

    for (const handler of handlers) {
      const data = handler._generateOpenApi(getRouteName(route));

      if (isNrfOasData(data)) {
        paths = { ...paths, ...data.paths };
        schemas = { ...schemas, ...data.schemas };
      }
    }
  }

  const sortObjectByKeys = <T extends { [key: string]: unknown }>(
    obj: T,
  ): T => {
    const unordered = { ...obj };

    return Object.keys(unordered)
      .sort()
      .reduce<{ [key: string]: unknown }>((_obj, key) => {
        // eslint-disable-next-line no-param-reassign
        _obj[key] = unordered[key];

        return _obj;
      }, {}) as T;
  };

  const components =
    Object.keys(schemas).length > 0
      ? { components: { schemas: sortObjectByKeys(schemas) } }
      : {};

  const spec: OpenAPI.Document = merge(
    {
      openapi: '3.1.0',
      info: openApiObject?.info ?? {},
      paths: sortObjectByKeys(paths),
    },
    components,
    openApiObject as OpenAPI.Document,
  );

  const openApiFilePath = path.join(process.cwd(), 'public', 'openapi.json');

  try {
    if (existsSync(path.join(process.cwd(), 'public'))) {
      const jsonSpec = await format(JSON.stringify(spec), {
        parser: 'json',
      });

      writeFileSync(openApiFilePath, jsonSpec, null);

      console.info('OpenAPI spec generated successfully!');
    } else {
      console.info(
        'The `public` folder was not found. Generating OpenAPI spec aborted.',
      );
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    console.error(`Error while generating the API spec: ${error}`);
  }
};
