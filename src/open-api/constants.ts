/* eslint-disable id-length */
import { DEFAULT_ERRORS } from '@/errors/http-errors';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

export const MESSAGE_WITH_ERRORS_SCHEMA: OpenAPI.SchemaObject = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'path', 'message'],
        properties: {
          code: {
            type: 'string',
            description: 'Discriminator field for the Zod issue type.',
          },
          path: {
            type: 'array',
            items: {
              oneOf: [
                {
                  type: 'string',
                },
                {
                  type: 'number',
                },
              ],
            },
            description:
              'Path to the error in the validated object, represented as an array of strings and/or numbers.',
          },
          message: {
            type: 'string',
            description:
              'Human-readable message describing the validation error.',
          },
        },
        additionalProperties: true,
      },
    },
  },
  required: ['message'],
  additionalProperties: false,
};

export const INVALID_REQUEST_BODY_RESPONSE: OpenAPI.ResponseObject = {
  description: DEFAULT_ERRORS.invalidRequestBody,
  content: {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/MessageWithErrors`,
      },
    },
  },
};

export const ERROR_MESSAGE_SCHEMA: OpenAPI.SchemaObject = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  additionalProperties: false,
};

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

export const INVALID_RPC_REQUEST_RESPONSE: OpenAPI.ResponseObject = {
  description: 'Error response.',
  content: {
    'application/json': {
      schema: {
        oneOf: [
          {
            description: DEFAULT_ERRORS.invalidRequestBody,
            $ref: `#/components/schemas/MessageWithErrors`,
          },
          {
            description: DEFAULT_ERRORS.unexpectedError,
            $ref: `#/components/schemas/ErrorMessage`,
          },
        ],
      },
    },
  },
};

export const INVALID_MEDIA_TYPE_RESPONSE: OpenAPI.ResponseObject = {
  description: DEFAULT_ERRORS.invalidMediaType,
  content: {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/ErrorMessage`,
      },
    },
  },
  headers: {
    Allow: {
      schema: {
        type: 'string',
      },
    },
  },
};

export const INVALID_QUERY_PARAMETERS_RESPONSE: OpenAPI.ResponseObject = {
  description: DEFAULT_ERRORS.invalidQueryParameters,
  content: {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/MessageWithErrors`,
      },
    },
  },
};

export const INVALID_PATH_PARAMETERS_RESPONSE: OpenAPI.ResponseObject = {
  description: DEFAULT_ERRORS.invalidPathParameters,
  content: {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/MessageWithErrors`,
      },
    },
  },
};
