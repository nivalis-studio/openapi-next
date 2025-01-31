import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

export type OpenApiPathItem = Partial<
  Pick<
    OpenAPI.PathItemObject,
    'summary' | 'description' | 'servers' | 'parameters'
  >
>;

export type OpenApiOperation = Partial<
  Pick<
    OpenAPI.OperationObject,
    | 'tags'
    | 'summary'
    | 'description'
    | 'externalDocs'
    | 'parameters'
    | 'callbacks'
    | 'deprecated'
    | 'security'
    | 'servers'
  >
>;
