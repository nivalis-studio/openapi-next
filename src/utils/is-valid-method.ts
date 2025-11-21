import type { HttpMethod } from '../lib/http';

const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
] as const;

export const isValidMethod = (x: unknown): x is HttpMethod =>
  HTTP_METHODS.includes(x as HttpMethod);
