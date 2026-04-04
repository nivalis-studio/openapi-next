import { Effect } from 'effect';
import { errorResponseBody, internalErrorBody } from '../errors/error-shape';
import { validateInput } from './validate-input';
import { validateOutput } from './validate-output';
import type {
  BoundRouteHandler,
  LegacyRouteDefinition,
  RouteContract,
  RouteHeaders,
  RouteInputData,
} from '../contract';
import type { ErrorCode } from '../errors/error-codes';

const asErrorCode = (code: string): ErrorCode => code as ErrorCode;
const INTERNAL_SERVER_ERROR_STATUS = 500;

const isJsonContentType = (contentType: string): boolean => {
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType.endsWith('+json');
};

const normalizeHeaders = (
  headers: RouteHeaders | undefined,
  contentType: string,
): Headers => {
  const normalized = new Headers(headers);
  normalized.set('content-type', contentType);
  return normalized;
};

type ResponseBody = ConstructorParameters<typeof Response>[0];

const toResponseBody = (body: unknown): ResponseBody => {
  if (body == null) {
    return null;
  }
  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream
  ) {
    return body;
  }

  return String(body);
};

type InputValidationError = {
  readonly _tag: 'InputValidationError';
  readonly error: unknown;
};

type HandlerError = {
  readonly _tag: 'HandlerError';
  readonly error: unknown;
};

type ExecutionError = InputValidationError | HandlerError;

/**
 * Internal Effect-based route execution.
 */
const executeRouteEffect = <TContract extends RouteContract>(
  route: TContract,
  routeHandler: BoundRouteHandler<TContract>,
  request: Request,
  context: { params: Promise<unknown> },
): Effect.Effect<Response, never> =>
  Effect.gen(function* () {
    const input = yield* Effect.tryPromise({
      try: () => validateInput(route, request, context.params),
      catch: (error): ExecutionError => ({
        _tag: 'InputValidationError',
        error,
      }),
    });

    if (!input.ok) {
      return Response.json(
        errorResponseBody(
          asErrorCode(input.error.code),
          input.error.message,
          input.error.status,
        ),
        { status: input.error.status },
      );
    }

    const result = yield* Effect.tryPromise({
      try: () =>
        Promise.resolve(
          routeHandler(
            request,
            context,
            input.data as RouteInputData<TContract>,
          ),
        ),
      catch: (error): ExecutionError => ({
        _tag: 'HandlerError',
        error,
      }),
    });

    const output = validateOutput(route.responses, result);
    if (!output.ok) {
      return Response.json(
        errorResponseBody(output.code, output.message, output.status),
        { status: output.status },
      );
    }

    const headers = normalizeHeaders(result.headers, result.contentType);

    if (isJsonContentType(result.contentType)) {
      return Response.json(output.body, {
        status: result.status,
        headers,
      });
    }

    return new Response(toResponseBody(output.body), {
      status: result.status,
      headers,
    });
  }).pipe(
    Effect.catchAll((error: ExecutionError) =>
      Effect.sync(() => {
        if (error._tag === 'HandlerError') {
          return Response.json(internalErrorBody(error.error), {
            status: INTERNAL_SERVER_ERROR_STATUS,
          });
        }

        return Response.json(internalErrorBody(error.error), {
          status: INTERNAL_SERVER_ERROR_STATUS,
        });
      }),
    ),
  );

/**
 * Execute a route definition with the given request.
 * Public API remains unchanged - returns Promise<Response>.
 */
const runRoute = <TContract extends RouteContract>(
  route: TContract,
  routeHandler: BoundRouteHandler<TContract>,
  request: Request,
  context: { params: Promise<unknown> },
): Promise<Response> => {
  const effect = executeRouteEffect(route, routeHandler, request, context);
  return Effect.runPromise(effect);
};

export function executeRoute<TContract extends RouteContract>(
  route: TContract,
  routeHandler: BoundRouteHandler<TContract>,
  request: Request,
  context: { params: Promise<unknown> },
): Promise<Response>;
export function executeRoute(
  route: LegacyRouteDefinition,
  request: Request,
  paramsPromise: Promise<unknown>,
): Promise<Response>;
export function executeRoute(
  route: RouteContract | LegacyRouteDefinition,
  routeHandlerOrRequest: unknown,
  requestOrParamsPromise: Request | Promise<unknown>,
  context?: { params: Promise<unknown> },
): Promise<Response> {
  if (typeof routeHandlerOrRequest === 'function') {
    return runRoute(
      route,
      routeHandlerOrRequest as BoundRouteHandler<RouteContract>,
      requestOrParamsPromise as Request,
      context ?? { params: Promise.resolve({}) },
    );
  }

  const legacyRoute = route as LegacyRouteDefinition;
  const request = routeHandlerOrRequest as Request;
  const paramsPromise = requestOrParamsPromise as Promise<unknown>;

  return runRoute(
    legacyRoute,
    async (_request, _context, input) => legacyRoute.handler(input),
    request,
    { params: paramsPromise },
  );
}
