import {
  toRequestJsonSchema,
  toResponseJsonSchema,
  type ZodToJsonOptions,
} from '../core/openapi/json-schema';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { z } from 'zod';

const isZodSchema = (schema: unknown): schema is z.ZodType =>
  schema != null && typeof schema === 'object' && '_def' in schema;

const zodSchemaValidator = <Output, Schema extends z.ZodType<Output>>({
  schema,
  obj,
}: {
  schema: Schema;
  obj: unknown;
}) => {
  const data = schema.safeParse(obj);
  const errors = data.success ? null : data.error.issues;

  return {
    valid: data.success,
    errors,
    data: data.success ? data.data : null,
  };
};

export const validateSchema = <Output, Schema extends z.ZodType<Output>>({
  schema,
  obj,
}: {
  schema: Schema;
  obj: unknown;
}) => {
  if (isZodSchema(schema)) {
    return zodSchemaValidator({ schema, obj });
  }

  throw new Error('Invalid schema.');
};

type SchemaType = 'input-params' | 'input-query' | 'input-body' | 'output-body';

export type ToJsonOptions = ZodToJsonOptions;

const roleFromType = (
  type: SchemaType,
): 'params' | 'query' | 'requestBody' | 'responseBody' => {
  if (type === 'input-params') {
    return 'params';
  }

  if (type === 'input-query') {
    return 'query';
  }

  if (type === 'input-body') {
    return 'requestBody';
  }

  return 'responseBody';
};

export const getJsonSchema = ({
  schema,
  operationId,
  type,
  zodToJsonOptions,
}: {
  schema: z.ZodType;
  operationId: string;
  type: SchemaType;
  zodToJsonOptions?: ToJsonOptions;
}): OpenAPI.SchemaObject => {
  if (!isZodSchema(schema)) {
    throw new Error('Invalid schema.');
  }

  const context = {
    operationId,
    routePath: '<legacy-route>',
    method: '<legacy-method>',
    role: roleFromType(type),
  };

  return (
    type === 'output-body'
      ? toResponseJsonSchema(schema, context, zodToJsonOptions)
      : toRequestJsonSchema(schema, context, zodToJsonOptions)
  ) as OpenAPI.SchemaObject;
};
