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
  contentType: string;
  body: unknown;
  headers?: RouteHeaders;
};

export type RouteDefinition = {
  method: HttpMethod;
  operationId: string;
  input?: RouteInput;
  responses: RouteResponses;
  handler: (context: {
    params: unknown;
    query: unknown;
    body: unknown;
  }) => Promise<RouteHandlerResult> | RouteHandlerResult;
};

export type DefinedRoute = {
  next: NextRouteHandler;
  _route: RouteDefinition;
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
