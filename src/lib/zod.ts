import zodToJsonSchema from 'zod-to-json-schema';
import type { Options } from 'zod-to-json-schema';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { ZodSchema } from 'zod';

const isZodSchema = (schema: unknown): schema is ZodSchema =>
  !!schema && typeof schema === 'object' && '_def' in schema;

const zodSchemaValidator = ({
  schema,
  obj,
}: {
  schema: ZodSchema;
  obj: unknown;
}) => {
  const data = schema.safeParse(obj);
  const errors = data.success ? null : data.error.issues;

  return {
    valid: data.success,
    errors,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    data: data.success ? data.data : null,
  };
};

export const validateSchema = ({
  schema,
  obj,
}: {
  schema: ZodSchema;
  obj: unknown;
}) => {
  if (isZodSchema(schema)) {
    return zodSchemaValidator({ schema, obj });
  }

  throw new Error('Invalid schema.');
};

type SchemaType = 'input-params' | 'input-query' | 'input-body' | 'output-body';

export const getJsonSchema = ({
  schema,
  operationId,
  type,
  zodToJsonOptions,
}: {
  schema: ZodSchema;
  operationId: string;
  type: SchemaType;
  zodToJsonOptions?: Partial<Options<'openApi3'>>;
}): OpenAPI.SchemaObject => {
  console.log('getJsonSchema', { zodToJsonOptions });

  if (isZodSchema(schema)) {
    try {
      return zodToJsonSchema(schema, {
        $refStrategy: 'none',
        ...zodToJsonOptions,
        target: 'openApi3',
      });
    } catch {
      console.warn(
        `
Warning: ${type} schema for operation ${operationId} could not be converted to a JSON schema. The OpenAPI spec may not be accurate.
This is most likely related to an issue with the \`zod-to-json-schema\`: https://github.com/StefanTerdell/zod-to-json-schema?tab=readme-ov-file#known-issues`,
      );

      return {};
    }
  }

  throw new Error('Invalid schema.');
};
