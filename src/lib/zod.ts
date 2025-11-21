import { z } from 'zod';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

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

export type ToJsonOptions = Parameters<typeof z.toJSONSchema>[1];

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
  if (isZodSchema(schema)) {
    try {
      return z.toJSONSchema(schema, {
        ...zodToJsonOptions,
        target: 'draft-2020-12',
      }) as OpenAPI.SchemaObject;
    } catch (error) {
      console.warn(
        error,
        `\nWarning: ${type} schema for operation ${operationId} could not be converted to a JSON schema. The OpenAPI spec may not be accurate.`,
      );

      return {};
    }
  }

  throw new Error('Invalid schema.');
};
