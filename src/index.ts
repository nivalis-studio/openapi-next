// biome-ignore-all lint/performance/noBarrelFile: Package entrypoint consolidates exports for consumers
export const generateOpenapiSpec: typeof import('./cli/public-generate-openapi').generateOpenapiSpec =
  async (...args) => {
    const { generateOpenapiSpec: lazyGenerateOpenapiSpec } = await import(
      './cli/public-generate-openapi'
    );

    return lazyGenerateOpenapiSpec(...args);
  };
export { defineRoute } from './core/define-route';
export type {
  DefinedRoute,
  HttpMethod,
  RouteDefinition,
  RouteHandlerResult,
  RouteInput,
  RouteResponses,
} from './core/contract';
