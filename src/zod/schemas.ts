import { zodToJsonSchema } from 'zod-to-json-schema';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { ZodSchema } from 'zod';

type SchemaType = 'input-params' | 'input-query' | 'input-body' | 'output-body';

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

export const getJsonSchema = ({
  schema,
  operationId,
  type,
}: {
  schema: ZodSchema;
  operationId: string;
  type: SchemaType;
}): OpenAPI.SchemaObject => {
  if (isZodSchema(schema)) {
    try {
      return zodToJsonSchema(schema, {
        $refStrategy: 'none',
        target: 'openApi3',
      });
    } catch {
      const solutions: { [key in SchemaType]: string } = {
        'input-params': 'paramsSchema',
        'input-query': 'querySchema',
        'input-body': 'bodySchema',
        'output-body': 'bodySchema',
      };

      console.warn(
        `
Warning: ${type} schema for operation ${operationId} could not be converted to a JSON schema. The OpenAPI spec may not be accurate.
This is most likely related to an issue with the \`zod-to-json-schema\`: https://github.com/StefanTerdell/zod-to-json-schema?tab=readme-ov-file#known-issues
Please consider using the ${solutions[type]} property in addition to the Zod schema.`,
      );

      return {};
    }
  }

  throw new Error('Invalid schema.');
};
