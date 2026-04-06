import { createNextHandler } from '../next/create-next-handler';
import type { BoundRouteHandler, RouteContract } from './contract';

/**
 * Defines a route contract without a handler.
 * Use this in `.contract.ts` files for OpenAPI generation.
 * The handler is attached separately in the `.route.ts` file.
 *
 * When a `path` is provided and Next.js typedRoutes is enabled,
 * the path will be validated against your app's routes and params
 * will be inferred from the path segments.
 */
export const defineContract = <TContract extends RouteContract>(
  definition: TContract,
): TContract => definition;

export const bindContract = <TContract extends RouteContract>(
  contract: TContract,
  handler: BoundRouteHandler<TContract>,
): ReturnType<typeof createNextHandler<TContract>> => {
  const nextHandler = createNextHandler(contract, handler);

  return nextHandler;
};
