import { describe, expect, it } from 'bun:test';
import { isJsonMediaType, normalizeMediaType } from './media-type';

describe('media-type utility', () => {
  it('normalizes media type and strips parameters', () => {
    expect(normalizeMediaType('Application/JSON; charset=utf-8')).toBe(
      'application/json',
    );
  });

  it('detects +json subtypes as json media', () => {
    expect(isJsonMediaType('application/problem+json')).toBe(true);
  });

  it('returns false for non-json media', () => {
    expect(isJsonMediaType('text/plain')).toBe(false);
  });
});
