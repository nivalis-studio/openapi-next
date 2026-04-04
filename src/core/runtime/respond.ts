import type {
  BoundRouteResponder,
  ContractRouteHandlerResult,
  RouteContract,
  RouteHeaders,
} from '../contract';

const toHeaders = (
  headers: RouteHeaders | undefined,
): RouteHeaders | undefined => headers;

export const createResponder = <
  TContract extends RouteContract,
>(): BoundRouteResponder<TContract> =>
  ({
    json: (status: number, body: unknown, headers?: RouteHeaders) =>
      ({
        status,
        contentType: 'application/json',
        body,
        headers: toHeaders(headers),
      }) as unknown as ContractRouteHandlerResult<TContract>,
    text: (status: number, body: string, headers?: RouteHeaders) =>
      ({
        status,
        contentType: 'text/plain',
        body,
        headers: toHeaders(headers),
      }) as unknown as ContractRouteHandlerResult<TContract>,
  }) as unknown as BoundRouteResponder<TContract>;
