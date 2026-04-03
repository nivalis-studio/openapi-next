import { z } from 'zod';
import { ERROR_CODES } from '../errors/error-codes';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';

export type ConversionContext = {
  operationId: string;
  routePath: string;
  method: string;
  role: 'params' | 'query' | 'requestBody' | 'responseBody';
};

export type ZodToJsonOptions = Parameters<typeof z.toJSONSchema>[1];

const getConversionOptions = (
  io: 'input' | 'output',
  options?: ZodToJsonOptions,
): ZodToJsonOptions => ({
  cycles: 'ref',
  reused: 'inline',
  ...options,
  io,
  target: 'draft-2020-12',
  unrepresentable: 'throw',
});

const convert = (
  schema: z.ZodType,
  context: ConversionContext,
  io: 'input' | 'output',
  options?: ZodToJsonOptions,
): OpenAPI.SchemaObject => {
  try {
    return z.toJSONSchema(
      schema,
      getConversionOptions(io, options),
    ) as OpenAPI.SchemaObject;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        ERROR_CODES.schemaConversionFailed,
        context.operationId,
        context.method,
        context.routePath,
        context.role,
        reason,
      ].join(' | '),
      error instanceof Error ? { cause: error } : undefined,
    );
  }
};

export const toRequestJsonSchema = (
  schema: z.ZodType,
  context: ConversionContext,
  options?: ZodToJsonOptions,
) => convert(schema, context, 'input', options);

export const toResponseJsonSchema = (
  schema: z.ZodType,
  context: ConversionContext,
  options?: ZodToJsonOptions,
) => convert(schema, context, 'output', options);
