// biome-ignore lint/performance/noBarrelFile: Package entrypoint consolidates exports for consumers
export { generateOpenapiSpec } from './cli';
export { routeHandler as route } from './handler';
export * from './lib/response';
export { TypedNextResponse } from './types/operation';
export type { TypedNextRequest } from './types/operation';
