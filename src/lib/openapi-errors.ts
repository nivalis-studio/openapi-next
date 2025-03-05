import { DEFAULT_ERRORS } from '../errors';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

export const ERROR_MESSAGE_SCHEMA: OpenAPI.SchemaObject = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  additionalProperties: false,
};

export const UNEXPECTED_ERROR_RESPONSE: OpenAPI.ResponseObject = {
  description: DEFAULT_ERRORS.internalServerError,
  content: {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/ErrorMessage`,
      },
    },
  },
};
