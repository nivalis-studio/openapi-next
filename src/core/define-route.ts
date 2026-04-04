import { createNextHandler } from '../next/create-next-handler';
import type { BoundRouteHandler, RouteContract } from './contract';

/**
 * Defines a route contract without a handler.
 * Use this in `.contract.ts` files for OpenAPI generation.
 * The handler is attached separately in the `.route.ts` file.
 */
export const defineRouteContract = <TContract extends RouteContract>(
  definition: TContract,
): TContract => definition;

export const bindContract = <TContract extends RouteContract>(
  contract: TContract,
  handler: BoundRouteHandler<TContract>,
): ReturnType<typeof createNextHandler<TContract>> => {
  const nextHandler = createNextHandler(contract, handler);

  return nextHandler;
};
