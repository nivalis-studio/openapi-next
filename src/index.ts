// biome-ignore-all lint/performance/noBarrelFile: Package entrypoint consolidates exports for consumers
export const generateOpenapiSpec: typeof import('./cli/public-generate-openapi').generateOpenapiSpec =
  async (...args) => {
    const { generateOpenapiSpec: lazyGenerateOpenapiSpec } = await import(
      './cli/public-generate-openapi'
    );

    return lazyGenerateOpenapiSpec(...args);
  };
export { bindContract, defineRouteContract } from './core/define-route';
export type {
  BoundRouteHandler,
  ContractRouteHandlerResult,
  HttpMethod,
  RouteContract,
  RouteDefinition,
  RouteHandlerResult,
  RouteInput,
  RouteInputData,
  RouteResponses,
} from './core/contract';
