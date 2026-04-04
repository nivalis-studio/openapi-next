import type { z } from 'zod';

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

export type ResponseStatuses<TContract extends RouteContract> = Extract<
  keyof TContract['responses'],
  number
>;

export type ResponseContentTypes<
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

export type ContractStatusesWithMedia<
  TContract extends RouteContract,
  TMedia extends string,
> = Extract<
  {
    [Status in ResponseStatuses<TContract>]: TMedia extends ResponseContentTypes<
      TContract,
      Status
    >
      ? Status
      : never;
  }[ResponseStatuses<TContract>],
  number
>;

export type ContractResponseByStatusAndMedia<
  TContract extends RouteContract,
  TStatus extends ResponseStatuses<TContract>,
  TMedia extends ResponseContentTypes<TContract, TStatus>,
> = {
  status: TStatus;
  contentType?: TMedia;
  body: ResponseBody<TContract, TStatus, TMedia>;
  headers?: RouteHeaders;
};

export type BoundRouteContext<TContract extends RouteContract> = {
  request: Request;
  params: RouteInputData<TContract>['params'];
  query: RouteInputData<TContract>['query'];
  body: RouteInputData<TContract>['body'];
};

// Helper type to extract response body for a given status and media type
// Returns never if the media type is not valid for the status
type ExtractResponseBody<
  TContract extends RouteContract,
  TStatus extends ResponseStatuses<TContract>,
  TMedia extends string,
> =
  TMedia extends ResponseContentTypes<TContract, TStatus>
    ? ResponseBody<TContract, TStatus, TMedia>
    : never;

// Helper to build the response object type for a valid status/media combination
type BuildResponse<
  TContract extends RouteContract,
  TStatus extends ResponseStatuses<TContract>,
  TMedia extends string,
> =
  TMedia extends ResponseContentTypes<TContract, TStatus>
    ? {
        status: TStatus;
        contentType?: TMedia;
        body: ResponseBody<TContract, TStatus, TMedia>;
        headers?: RouteHeaders;
      }
    : never;

export type BoundRouteResponder<TContract extends RouteContract> = {
  json: <
    TStatus extends ContractStatusesWithMedia<TContract, 'application/json'>,
  >(
    status: TStatus,
    body: ExtractResponseBody<TContract, TStatus, 'application/json'>,
    headers?: RouteHeaders,
  ) => BuildResponse<TContract, TStatus, 'application/json'>;
  text: <TStatus extends ContractStatusesWithMedia<TContract, 'text/plain'>>(
    status: TStatus,
    body: ExtractResponseBody<TContract, TStatus, 'text/plain'>,
    headers?: RouteHeaders,
  ) => BuildResponse<TContract, TStatus, 'text/plain'>;
};

export type BoundRouteHandler<TContract extends RouteContract> = (
  context: BoundRouteContext<TContract>,
  respond: BoundRouteResponder<TContract>,
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

export type NextRouteHandler = (
  request: Request,
  context: { params: Promise<unknown> },
) => Promise<Response>;
