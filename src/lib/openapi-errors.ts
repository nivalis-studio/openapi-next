import { DEFAULT_ERRORS } from '../errors';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

export const UNEXPECTED_ERROR_RESPONSE: OpenAPI.ResponseObject = {
  description: DEFAULT_ERRORS.unexpectedError,
  content: {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/ErrorMessage`,
      },
    },
  },
};
