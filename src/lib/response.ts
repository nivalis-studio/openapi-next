import { httpStatus } from '@nivalis/std/http-status';
import { z } from 'zod';
import type { HttpStatusError, HttpStatusOk } from '@nivalis/std/http-status';

export type OpenapiSuccess<
  ValueObj,
  StatusCode extends HttpStatusOk = typeof httpStatus.ok,
> = {
  success: true;
  timestamp: string;
  statusCode: StatusCode;
} & ValueObj;

export type OpenapiFailure<
  Err = Error,
  StatusCode extends HttpStatusError = typeof httpStatus.internalServerError,
> = {
  success: false;
  timestamp: string;
  error: Err;
  statusCode: StatusCode;
  message: string;
};

export type OpenapiResult<V, StatusCode extends HttpStatusError, E = Error> =
  | OpenapiSuccess<V>
  | OpenapiFailure<E, StatusCode>;

export type ToOpenapiResult<
  T extends z.ZodObject,
  E extends Array<HttpStatusError>,
> = Promise<OpenapiResult<z.infer<T>, E[number]>>;

export const openapiSuccess = <
  V,
  StatusCode extends HttpStatusOk = typeof httpStatus.ok,
>(
  value: V,
  statusCode?: StatusCode,
): OpenapiSuccess<V, StatusCode> => ({
  success: true,
  timestamp: new Date().toISOString(),
  statusCode: (statusCode ?? httpStatus.ok) as StatusCode,
  ...value,
});

export const openapiFailure = <
  E = Error,
  StatusCode extends HttpStatusError = typeof httpStatus.internalServerError,
>({
  error,
  message,
  statusCode,
}: {
  error?: E;
  message?: string;
  statusCode?: StatusCode;
}): OpenapiFailure<E, StatusCode> => {
  return {
    success: false,
    timestamp: new Date().toISOString(),
    error: (error ?? new Error(message ?? 'Unknown error')) as E,
    statusCode: (statusCode ?? httpStatus.internalServerError) as StatusCode,
    message:
      message ?? (error instanceof Error ? error.message : 'Unknown error'),
  };
};

export const openapiFailureSchema = z.object({
  success: z.literal(false),
  timestamp: z.iso.datetime(),
  statusCode: z.number(),
  message: z.string(),
});

export const openapiSuccessSchema = z.object({
  success: z.literal(true),
  timestamp: z.iso.datetime(),
});

const getOpenApiSuccessOutput = <T extends z.ZodObject>(outputSchema: T) =>
  openapiSuccessSchema.extend(outputSchema.shape as T['shape']);

type MergedSuccessOutput<T extends z.ZodObject> = ReturnType<
  typeof getOpenApiSuccessOutput<T>
>;

export const getOpenapiOutputs = <
  T extends z.ZodObject,
  E extends Array<HttpStatusError>,
>(
  outputSchema: T,
  errors: E = [] as unknown as E,
): [
  {
    contentType: 'application/json';
    status: typeof httpStatus.ok;
    body: MergedSuccessOutput<T>;
  },
  ...Array<{
    contentType: 'application/json';
    status: E[number];
    body: typeof openapiFailureSchema;
  }>,
] => [
  {
    contentType: 'application/json',
    status: httpStatus.ok,
    body: getOpenApiSuccessOutput(outputSchema),
  },
  ...errors.map(status => ({
    contentType: 'application/json' as const,
    status,
    body: openapiFailureSchema,
  })),
];
