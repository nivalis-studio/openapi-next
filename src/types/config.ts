import type { OpenApiObject } from './openapi';

export type DocsProvider = 'redoc' | 'swagger-ui';

export type FrameworkConfig = {
  /*!
   * Array of paths that are denied by openapi-next and not included in the OpenAPI spec.
   * Supports wildcards using asterisk `*` and double asterisk `**` for recursive matching.
   * Example: `['/api/disallowed-path', '/api/disallowed-path-2/*', '/api/disallowed-path-3/**']`
   * Defaults to no paths being disallowed.
   */
  deniedPaths?: string[];
  /*!
   * Array of paths that are allowed by openapi-next and included in the OpenAPI spec.
   * Supports wildcards using asterisk `*` and double asterisk `**` for recursive matching.
   * Example: `['/api/allowed-path', '/api/allowed-path-2/*', '/api/allowed-path-3/**']`
   * Defaults to all paths being allowed.
   */
  allowedPaths?: string[];
  /*! An OpenAPI Object that can be used to override and extend the auto-generated specification: https://swagger.io/specification/#openapi-object */
  openApiObject?: OpenApiObject;
  /*! Path that will be used for fetching the OpenAPI spec - defaults to `/openapi.json`. This path also determines the path where this file will be generated inside the `public` folder. */
  openApiJsonPath?: string;
  /*! Customization options for the generated docs. */
  docsConfig?: {
    /*! Determines whether to render the docs using Redoc (`redoc`) or SwaggerUI `swagger-ui`. Defaults to `redoc`. */
    provider?: DocsProvider;
    /*! Custom title, used for the visible title and HTML title.  */
    title?: string;
    /*! Custom description, used for the visible description and HTML meta description. */
    description?: string;
    /*! Custom HTML meta favicon URL. */
    faviconUrl?: string;
    /*! A URL for a custom logo. */
    logoUrl?: string;
    /*! Basic customization options for OG meta tags: https://ogp.me/#metadata */
    ogConfig?: {
      title: string /*! og:title */;
      type: string /*! og:type */;
      url: string /*! og:url */;
      imageUrl: string /*! og:image */;
    };
  };
};
