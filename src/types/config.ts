import type { OpenApiObject } from '@/types/openapi';

export type FrameworkConfig = {
  /*!
   * Array of paths that are denied by Next REST Framework and not included in the OpenAPI spec.
   * Supports wildcards using asterisk `*` and double asterisk `**` for recursive matching.
   * Example: `['/api/disallowed-path', '/api/disallowed-path-2/*', '/api/disallowed-path-3/**']`
   * Defaults to no paths being disallowed.
   */
  deniedPaths?: string[];
  /*!
   * Array of paths that are allowed by Next REST Framework and included in the OpenAPI spec.
   * Supports wildcards using asterisk `*` and double asterisk `**` for recursive matching.
   * Example: `['/api/allowed-path', '/api/allowed-path-2/*', '/api/allowed-path-3/**']`
   * Defaults to all paths being allowed.
   */
  allowedPaths?: string[];
  /*! An OpenAPI Object that can be used to override and extend the auto-generated specification: https://swagger.io/specification/#openapi-object */
  openApiObject?: OpenApiObject;
  /*! Path that will be used for fetching the OpenAPI spec - defaults to `/openapi.json`. This path also determines the path where this file will be generated inside the `public` folder. */
  openApiJsonPath?: string;
};
