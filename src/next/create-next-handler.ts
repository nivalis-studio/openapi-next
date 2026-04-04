import { buildOperation } from '../core/openapi/build-operation';
import { executeRoute } from '../core/runtime/execute-route';
import type {
  BoundRouteHandler,
  NextRouteHandler,
  RouteContract,
} from '../core/contract';
import type { ToJsonOptions } from '../lib/zod';
import type { NrfOasData } from '../types/open-api';

export const createNextHandler = <TContract extends RouteContract>(
  contract: TContract,
  routeHandler: BoundRouteHandler<TContract>,
): NextRouteHandler => {
  const handler: NextRouteHandler = async (
    request: Request,
    context: { params: Promise<unknown> },
  ) => executeRoute(contract, routeHandler, request, context);

  handler._generateOpenApi = (
    routeName: string,
    zodToJsonOptions?: ToJsonOptions,
  ): NrfOasData => ({
    paths: {
      [routeName]: {
        [contract.method.toLowerCase()]: buildOperation({
          routePath: routeName,
          route: contract,
          zodToJsonOptions,
        }),
      },
    },
    schemas: {},
  });

  return handler;
};
