import { NextResponse } from 'next/server';
import type { ZodSchema, z } from 'zod';
import type {
  AnyContentTypeWithAutocompleteForMostCommonOnes,
  BaseContentType,
} from './content-type';
import type { NextURL } from 'next/dist/server/web/next-url';
import type { NextRequest } from 'next/server';
import type { HttpMethod } from '../lib/http';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import type { AnyCase, Modify } from './helpers';

export type BaseOptions = { [key: string]: unknown };
export type BaseQuery = { [key: string]: string | string[] };
export type BaseParams = { [key: string]: string };
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type BaseStatus = number;

export type InputObject<
  ContentType = BaseContentType,
  Body = unknown,
  Query = BaseQuery,
  Params = BaseParams,
> = {
  contentType?: ContentType;
  body?: ZodSchema<Body>;
  query?: ZodSchema<Query>;
  params?: ZodSchema<Params>;
};

export type OutputObject<
  Body = unknown,
  Status extends BaseStatus = BaseStatus,
  ContentType extends
    AnyContentTypeWithAutocompleteForMostCommonOnes = AnyContentTypeWithAutocompleteForMostCommonOnes,
> = {
  body: ZodSchema<Body>;
  status: Status;
  contentType: ContentType;
  name?: string /*! A custom name for the response, used for the generated component name in the OpenAPI spec. */;
};

type TypedHeaders<ContentType extends BaseContentType> = Modify<
  { [key: string]: string },
  {
    [K in AnyCase<'Content-Type'>]?: ContentType;
  }
>;

type TypedResponseInit<
  Status extends BaseStatus,
  ContentType extends BaseContentType,
> = {
  nextConfig?: {
    basePath?: string;
    trailingSlash?: boolean;
  };
  url?: string;
  status?: Status;
  headers?: TypedHeaders<ContentType>;
} & globalThis.ResponseInit;

type ModifiedRequest = {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  headers?: Headers;
};

type TypedMiddlewareResponseInit<Status extends BaseStatus> = {
  request?: ModifiedRequest;
  status?: Status;
} & globalThis.ResponseInit;

type TypedSearchParams<Query = BaseQuery> = {
  get: (key: keyof Query & string) => string | null;
  getAll: (key: keyof Query & string) => string[];
} & URLSearchParams;

type TypedNextURL<Query = BaseQuery> = {
  searchParams: TypedSearchParams<Query>;
} & NextURL;

/**
 * Type definition for a strongly-typed Next.js request with enhanced type safety.
 * Extends the base NextRequest with additional type information for the request method,
 * content type, body, and query parameters.
 */
export type TypedNextRequest<
  Method extends string = HttpMethod,
  _ContentType = BaseContentType,
  Body = unknown,
  Query = BaseQuery,
> = {
  method: Method;
  /*! Prevent parsing JSON body for GET requests. Form requests return parsed form data as JSON when the form schema is defined. */
  json: Method extends 'GET' ? never : () => Promise<Body>;
  /*! Prevent parsing form data for GET and non-form requests. */
  formData: never;
  nextUrl: TypedNextURL<Query>;
} & NextRequest;

declare const INTERNALS: unique symbol;

// A patched `NextResponse` that sets strongly-typed properties.
export declare class TypedNextResponseType<
  Body,
  Status extends BaseStatus,
  ContentType extends BaseContentType,
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
> extends Response {
  [INTERNALS]: {
    cookies: ResponseCookies;
    url?: NextURL;
    body?: Body;
    status?: Status;
    contentType?: ContentType;
  };

  constructor(
    body?: BodyInit | null,
    init?: TypedResponseInit<Status, ContentType>,
  );

  get cookies(): ResponseCookies;

  static json<
    Body,
    Status extends BaseStatus,
    ContentType extends BaseContentType,
  >(
    body: Body,
    init?: TypedResponseInit<Status, ContentType>,
  ): TypedNextResponseType<Body, Status, ContentType>;

  static redirect<
    Status extends BaseStatus,
    ContentType extends BaseContentType,
  >(
    url: string | NextURL | URL,
    init?: number | TypedResponseInit<Status, ContentType>,
  ): TypedNextResponseType<unknown, Status, ContentType>;

  static rewrite<
    Status extends BaseStatus,
    ContentType extends BaseContentType,
  >(
    destination: string | NextURL | URL,
    init?: TypedMiddlewareResponseInit<Status>,
  ): TypedNextResponseType<unknown, Status, ContentType>;

  static next<Status extends BaseStatus, ContentType extends BaseContentType>(
    init?: TypedMiddlewareResponseInit<Status>,
  ): TypedNextResponseType<unknown, Status, ContentType>;
}

export type TypedRouteHandler<
  Method extends HttpMethod = HttpMethod,
  ContentType extends BaseContentType = BaseContentType,
  Body = unknown,
  Query extends BaseQuery = BaseQuery,
  Params extends BaseParams = BaseParams,
  Options extends BaseOptions = BaseOptions,
  ResponseBody = unknown,
  Status extends BaseStatus = BaseStatus,
  ResponseContentType extends BaseContentType = BaseContentType,
  Outputs extends ReadonlyArray<
    OutputObject<ResponseBody, Status, ResponseContentType>
  > = ReadonlyArray<OutputObject<ResponseBody, Status, ResponseContentType>>,
  // eslint-disable-next-line style/type-generic-spacing
  TypedResponse =
    | TypedNextResponseType<
        z.infer<Outputs[number]['body']>,
        Outputs[number]['status'],
        Outputs[number]['contentType']
      >
    | NextResponse<z.infer<Outputs[number]['body']>>
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    | void,
> = (
  req: TypedNextRequest<Method, ContentType, Body, Query>,
  context: { params: Params },
  options: Options,
) => Promise<TypedResponse> | TypedResponse;

export type ActionContext<
  Body = unknown,
  Query extends BaseQuery = BaseQuery,
  Params extends BaseParams = BaseParams,
> = {
  body: Body;
  query: Query;
  params: Params;
};

export type TypedRouteAction<
  _Method extends HttpMethod = HttpMethod,
  _ContentType extends BaseContentType = BaseContentType,
  Body = unknown,
  Query extends BaseQuery = BaseQuery,
  Params extends BaseParams = BaseParams,
  Options extends BaseOptions = BaseOptions,
  ResponseBody = unknown,
  Status extends BaseStatus = BaseStatus,
  ResponseContentType extends BaseContentType = BaseContentType,
  Outputs extends ReadonlyArray<
    OutputObject<ResponseBody, Status, ResponseContentType>
  > = ReadonlyArray<OutputObject<ResponseBody, Status, ResponseContentType>>,
  // eslint-disable-next-line style/type-generic-spacing
  TypedResponse =
    | TypedNextResponseType<
        z.infer<Outputs[number]['body']>,
        Outputs[number]['status'],
        Outputs[number]['contentType']
      >
    | NextResponse<z.infer<Outputs[number]['body']>>
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    | void,
> = (
  context: ActionContext<Body, Query, Params>,
  options: Options,
) => Promise<TypedResponse> | TypedResponse;

export type RouteOperationDefinition = {
  input?: InputObject;
  outputs?: readonly OutputObject[];
  handler?: TypedRouteHandler;
};

/**
 * Type definition for a strongly-typed Next.js response with enhanced type safety.
 * Extends the base NextResponse with additional type information for the response status,
 * content type, body, and query parameters.
 */
// @ts-expect-error - Keep the original NextResponse functionality with custom types.
export const TypedNextResponse: typeof TypedNextResponseType = NextResponse;
