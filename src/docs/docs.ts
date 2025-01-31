import type { FrameworkConfig } from '../types/config';

// Return HTML for Redoc or Swagger UI.
export const getHtmlForDocs = ({
  config: {
    openApiJsonPath,
    openApiObject,
    docsConfig: {
      provider,
      title = openApiObject?.info?.title ?? 'OpenAPI',
      description = openApiObject?.info?.description ?? 'API Documentation',
      faviconUrl = '',
      logoUrl = '',
      ogConfig: {
        title: ogTitle = title,
        type: ogType = 'website',
        url: orgUrl = '',
        imageUrl: ogImageUrl = '',
      } = {
        title: 'OpenAPI',
        type: 'website',
        url: '',
        imageUrl: '',
      },
    },
  },
  host,
}: {
  config: Required<FrameworkConfig>;
  host: string;
}) => {
  const url = `//${host}${openApiJsonPath}`; // Use protocol-relative URL to avoid mixed content warnings.

  const htmlMetaTags = `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta
      name="description"
      content="${description}"
    />
    <link rel="icon" type="image/x-icon" href="${faviconUrl}">
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${orgUrl}" />
    <meta property="og:image" content="${ogImageUrl}" />`;

  const redocHtml = `<!DOCTYPE html>
<html>
  <head>
    ${htmlMetaTags}
    <link
      href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="redoc"></div>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
      window.onload = () => {
        fetch('${url}')
          .then(res => res.json())
          .then(spec => {
            spec.info['title'] = "${title}";
            spec.info['description'] = "${description}";
            spec.info['x-logo'] = { url: "${logoUrl}" };
            Redoc.init(spec, {}, document.getElementById('redoc'));
          });
      };
    </script>
  </body>
</html>`;

  const swaggerUiHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    ${htmlMetaTags}
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
    <style>
      .topbar-wrapper img {
        content:url('${logoUrl}');
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = () => {
        fetch('${url}')
          .then(res => res.json())
          .then(spec => {
            spec.info['title'] = "${title}";
            spec.info['description'] = "${description}";

            window.ui = SwaggerUIBundle({
              spec,
              dom_id: '#swagger-ui',
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              layout: 'StandaloneLayout',
              deepLinking: true,
              displayOperationId: true,
              displayRequestDuration: true,
              filter: true
            });
          });
      };
    </script>
  </body>
</html>`;

  if (provider === 'swagger-ui') {
    return swaggerUiHtml;
  }

  return redocHtml;
};
