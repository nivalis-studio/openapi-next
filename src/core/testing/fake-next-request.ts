import type { HttpMethod } from '../contract';

export const createJsonRequest = (
  url: string,
  method: HttpMethod,
  body?: unknown,
): Request => {
  const init: RequestInit = { method };

  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
};
