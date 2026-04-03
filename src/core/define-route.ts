import { createNextHandler } from '../next/create-next-handler';
import type { DefinedRoute, RouteDefinition } from './contract';

export const defineRoute = (definition: RouteDefinition): DefinedRoute => {
  return {
    next: createNextHandler(definition),
    _route: definition,
  };
};

/**
 * Defines a route contract without a handler.
 * Use this in `.contract.ts` files for OpenAPI generation.
 * The handler is attached separately in the `.route.ts` file.
 */
export const defineRouteContract = (
  definition: Omit<RouteDefinition, 'handler'>,
): { _route: RouteDefinition } => {
  return {
    _route: {
      ...definition,
      // Placeholder handler - never called during generation
      handler: async () => ({
        status: 500,
        contentType: 'application/json',
        body: { error: 'Handler not implemented' },
      }),
    } as RouteDefinition,
  };
};
