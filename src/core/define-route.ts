import { createNextHandler } from '../next/create-next-handler';
import type { DefinedRoute, RouteDefinition } from './contract';

export const defineRoute = (definition: RouteDefinition): DefinedRoute => {
  return {
    next: createNextHandler(definition),
    _route: definition,
  };
};
