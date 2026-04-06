import { Effect } from 'effect';
import { errorResponseBody, internalErrorBody } from '../errors/error-shape';
import { isJsonMediaType, normalizeMediaType } from './media-type';
import { createResponder } from './respond';
import { validateInput } from './validation';
import type { NextRequest } from 'next/server';
import type {
  BoundRouteHandler,
  RouteContract,
  RouteHeaders,
  RouteInputData,
} from '../contract';
import type { ErrorCode } from '../errors/error-codes';

const asErrorCode = (code: string): ErrorCode => code as ErrorCode;
const INTERNAL_SERVER_ERROR_STATUS = 500;

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
  request: NextRequest,
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

    const validatedInput = input.data as RouteInputData<TContract>;
    const routeContext = {
      request,
      params: validatedInput.params,
      query: validatedInput.query,
      body: validatedInput.body,
    };
    const respond = createResponder() as unknown as Parameters<
      BoundRouteHandler<TContract>
    >[1];

    const result = yield* Effect.tryPromise({
      try: () => Promise.resolve(routeHandler(routeContext, respond)),
      catch: (error): ExecutionError => ({
        _tag: 'HandlerError',
        error,
      }),
    });

    const contentType = result.contentType ?? 'application/json';
    const normalized = normalizeMediaType(contentType);

    const headers = normalizeHeaders(result.headers, contentType);

    if (isJsonMediaType(normalized)) {
      return Response.json(result.body, {
        status: result.status,
        headers,
      });
    }

    return new Response(toResponseBody(result.body), {
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
 * Execute a route with the given handler and request.
 * Returns a Promise<Response>.
 */
export function executeRoute<TContract extends RouteContract>(
  route: TContract,
  routeHandler: BoundRouteHandler<TContract>,
  request: NextRequest,
  context: { params: Promise<unknown> },
): Promise<Response> {
  const effect = executeRouteEffect(route, routeHandler, request, context);
  return Effect.runPromise(effect);
}
