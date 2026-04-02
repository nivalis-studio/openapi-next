import { buildOperation } from '../core/openapi/build-operation';
import { executeRoute } from '../core/runtime/execute-route';
import type { NextRouteHandler, RouteDefinition } from '../core/contract';
import type { ToJsonOptions } from '../lib/zod';
import type { NrfOasData } from '../types/open-api';

export const createNextHandler = (route: RouteDefinition): NextRouteHandler => {
  const handler: NextRouteHandler = async (
    request: Request,
    context: { params: Promise<unknown> },
  ) => executeRoute(route, request, context.params);

  handler._generateOpenApi = (
    routeName: string,
    zodToJsonOptions?: ToJsonOptions,
  ): NrfOasData => ({
    paths: {
      [routeName]: {
        [route.method.toLowerCase()]: buildOperation({
          routePath: routeName,
          route,
          zodToJsonOptions,
        }),
      },
    },
    schemas: {},
  });

  return handler;
};
