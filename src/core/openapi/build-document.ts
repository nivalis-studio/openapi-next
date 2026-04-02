import { ERROR_CODES } from '../errors/error-codes';
import { buildOperation } from './build-operation';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { RouteDefinition } from '../contract';

const toPathMethod = (
  method: RouteDefinition['method'],
): keyof OpenAPI.PathItemObject =>
  method.toLowerCase() as keyof OpenAPI.PathItemObject;

export const buildDocument = ({
  info,
  routes,
}: {
  info: Pick<OpenAPI.InfoObject, 'title' | 'version' | 'description'>;
  routes: Array<{ routePath: string; route: RouteDefinition }>;
}): OpenAPI.Document => {
  const seenOperationIds = new Set<string>();

  const paths = routes.reduce<OpenAPI.PathsObject>((acc, current) => {
    const method = toPathMethod(current.route.method);
    const existingPath = acc[current.routePath] as
      | OpenAPI.PathItemObject
      | undefined;

    if (seenOperationIds.has(current.route.operationId)) {
      throw new Error(
        `${ERROR_CODES.duplicateOperationId} | ${current.route.operationId}`,
      );
    }

    if (existingPath?.[method] != null) {
      throw new Error(
        `${ERROR_CODES.duplicatePathMethod} | ${current.routePath} | ${current.route.method}`,
      );
    }

    seenOperationIds.add(current.route.operationId);

    acc[current.routePath] = {
      ...(existingPath ?? {}),
      [method]: buildOperation(current),
    };

    return acc;
  }, {});

  return {
    openapi: '3.1.0',
    info,
    paths,
  };
};
