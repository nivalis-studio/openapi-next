import type { z } from 'zod';
import type { ToJsonOptions } from '../lib/zod';
import type { NrfOasData } from '../types/open-api';

export type RouteHeaders =
  | Headers
  | Record<string, string>
  | Array<[string, string]>;

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

export type RouteInput = {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  contentType?: string;
};

export type RouteResponses = Record<
  number,
  {
    description: string;
    content: Record<string, { schema: z.ZodType }>;
  }
>;

export type RouteHandlerResult = {
  status: number;
  contentType?: string;
  body: unknown;
  headers?: RouteHeaders;
};

export type RouteContract = {
  method: HttpMethod;
  operationId: string;
  input?: RouteInput;
  responses: RouteResponses;
};

type InputValue<
  TContract extends RouteContract,
  Key extends 'params' | 'query' | 'body',
> =
  TContract['input'] extends Record<Key, infer Schema>
    ? Schema extends z.ZodType
      ? z.output<Schema>
      : unknown
    : unknown;

type ResponseStatuses<TContract extends RouteContract> = Extract<
  keyof TContract['responses'],
  number
>;

type ResponseContentTypes<
  TContract extends RouteContract,
  Status extends ResponseStatuses<TContract>,
> = Extract<keyof TContract['responses'][Status]['content'], string>;

type ResponseBody<
  TContract extends RouteContract,
  Status extends ResponseStatuses<TContract>,
  ContentType extends ResponseContentTypes<TContract, Status>,
> = TContract['responses'][Status]['content'][ContentType]['schema'] extends z.ZodType
  ? z.output<TContract['responses'][Status]['content'][ContentType]['schema']>
  : unknown;

export type RouteInputData<TContract extends RouteContract> = {
  params: InputValue<TContract, 'params'>;
  query: InputValue<TContract, 'query'>;
  body: InputValue<TContract, 'body'>;
};

type ContractRouteHandlerResultForStatus<
  TContract extends RouteContract,
  Status extends ResponseStatuses<TContract>,
> = {
  [ContentType in ResponseContentTypes<TContract, Status>]: {
    status: Status;
    contentType?: ContentType;
    body: ResponseBody<TContract, Status, ContentType>;
    headers?: RouteHeaders;
  };
}[ResponseContentTypes<TContract, Status>];

export type ContractRouteHandlerResult<TContract extends RouteContract> = {
  [Status in ResponseStatuses<TContract>]: ContractRouteHandlerResultForStatus<
    TContract,
    Status
  >;
}[ResponseStatuses<TContract>];

export type BoundRouteHandler<TContract extends RouteContract> = (
  request: Request,
  context: { params: Promise<unknown> },
  input: RouteInputData<TContract>,
) =>
  | Promise<ContractRouteHandlerResult<TContract>>
  | ContractRouteHandlerResult<TContract>;

export type RouteDefinition = RouteContract & {
  handler?: (context: {
    params: unknown;
    query: unknown;
    body: unknown;
  }) => Promise<RouteHandlerResult> | RouteHandlerResult;
};

export type NextRouteHandler = ((
  request: Request,
  context: { params: Promise<unknown> },
) => Promise<Response>) & {
  _generateOpenApi: (
    routeName: string,
    zodToJsonOptions?: ToJsonOptions,
  ) => NrfOasData;
};
