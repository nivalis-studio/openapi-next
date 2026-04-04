import { executeRoute } from '../core/runtime/execute-route';
import type {
  BoundRouteHandler,
  NextRouteHandler,
  RouteContract,
} from '../core/contract';

export const createNextHandler = <TContract extends RouteContract>(
  contract: TContract,
  routeHandler: BoundRouteHandler<TContract>,
): NextRouteHandler => {
  const handler: NextRouteHandler = async (
    request: Request,
    context: { params: Promise<unknown> },
  ) => executeRoute(contract, routeHandler, request, context);

  return handler;
};
