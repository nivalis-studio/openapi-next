import type { ValidMethod } from '@/types/methods';
import type { OpenApiOperation } from '@/types/openapi';
import type { NextURL } from 'next/dist/server/web/next-url';
import type { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies';
import type { NextRequest, NextResponse } from 'next/server';
import type { OpenAPIV3_1 as OpenAPI } from 'openapi-types';
import type { ZodSchema, z } from 'zod';

// Ref: https://twitter.com/diegohaz/status/1524257274012876801
export type StringWithAutocomplete<T> =
  | T
  | (string & { [key in never]: never });

export type AnyCase<T extends string> = T | Uppercase<T> | Lowercase<T>;
export type Modify<T, R> = Omit<T, keyof R> & R;

// Content types ref: https://stackoverflow.com/a/48704300
export type AnyContentTypeWithAutocompleteForMostCommonOnes =
  StringWithAutocomplete<
    | 'application/java-archive'
    | 'application/EDI-X12'
    | 'application/EDIFACT'
    | 'application/javascript'
    | 'application/octet-stream'
    | 'application/ogg'
    | 'application/pdf'
    | 'application/xhtml+xml'
    | 'application/x-shockwave-flash'
    | 'application/json'
    | 'application/ld+json'
    | 'application/xml'
    | 'application/zip'
    | 'application/x-www-form-urlencoded'
    /********************/
    | 'audio/mpeg'
    | 'audio/x-ms-wma'
    | 'audio/vnd.rn-realaudio'
    | 'audio/x-wav'
    /********************/
    | 'image/gif'
    | 'image/jpeg'
    | 'image/png'
    | 'image/tiff'
    | 'image/vnd.microsoft.icon'
    | 'image/x-icon'
    | 'image/vnd.djvu'
    | 'image/svg+xml'
    /********************/
    | 'multipart/mixed'
    | 'multipart/alternative'
    | 'multipart/related'
    | 'multipart/form-data'
    /********************/
    | 'text/css'
    | 'text/csv'
    | 'text/html'
    | 'text/javascript'
    | 'text/plain'
    | 'text/xml'
    /********************/
    | 'video/mpeg'
    | 'video/mp4'
    | 'video/quicktime'
    | 'video/x-ms-wmv'
    | 'video/x-msvideo'
    | 'video/x-flv'
    | 'video/webm'
    /********************/
    | 'application/vnd.android.package-archive'
    | 'application/vnd.oasis.opendocument.text'
    | 'application/vnd.oasis.opendocument.spreadsheet'
    | 'application/vnd.oasis.opendocument.presentation'
    | 'application/vnd.oasis.opendocument.graphics'
    | 'application/vnd.ms-excel'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'application/vnd.ms-powerpoint'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    | 'application/msword'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.mozilla.xul+xml'
  >;

export type ContentTypesThatSupportInputValidation =
  | 'application/json'
  | 'application/x-www-form-urlencoded'
  | 'multipart/form-data';

export type BaseContentType = AnyContentTypeWithAutocompleteForMostCommonOnes;
export type BaseStatus = number;
export type BaseQuery = { [key: string]: string | string[] };
export type BaseParams = { [key: string]: string };
export type BaseOptions = { [key: string]: unknown };

type InputObject<
  ContentType = BaseContentType,
  Body = unknown,
  Query = BaseQuery,
  Params = BaseParams,
> = {
  contentType?: ContentType;
  /*! Body schema is supported only for certain content types that support input validation. */
  body?: ContentType extends ContentTypesThatSupportInputValidation
    ? ZodSchema<Body>
    : never;
  /*! If defined, this will override the body schema for the OpenAPI spec. */
  bodySchema?: OpenAPI.SchemaObject | OpenAPI.ReferenceObject;
  query?: ZodSchema<Query>;
  /*! If defined, this will override the query schema for the OpenAPI spec. */
  querySchema?: OpenAPI.SchemaObject | OpenAPI.ReferenceObject;
  params?: ZodSchema<Params>;
  /*! If defined, this will override the params schema for the OpenAPI spec. */
  paramsSchema?: OpenAPI.SchemaObject | OpenAPI.ReferenceObject;
};

export type OutputObject<
  Body = unknown,
  Status extends BaseStatus = BaseStatus,
  ContentType extends
    AnyContentTypeWithAutocompleteForMostCommonOnes = AnyContentTypeWithAutocompleteForMostCommonOnes,
> = {
  body: ZodSchema<Body>;
  bodySchema?:
    | OpenAPI.SchemaObject
    | OpenAPI.ReferenceObject /*! If defined, this will override the body schema for the OpenAPI spec. */;
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

export type TypedNextRequest<
  Method extends string = ValidMethod,
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

type TypedRouteHandler<
  Method extends ValidMethod = ValidMethod,
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

export type RouteOperationDefinition = {
  method: ValidMethod;
  openApiOperation?: OpenApiOperation;
  input?: InputObject;
  outputs?: readonly OutputObject[];
  handler?: TypedRouteHandler;
};
