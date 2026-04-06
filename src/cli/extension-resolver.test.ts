import { describe, expect, it } from 'bun:test';
import { resolveWithExtensionFallback } from './extension-resolver';

describe('resolveWithExtensionFallback', () => {
  it('returns native resolution when available', async () => {
    const resolved = await resolveWithExtensionFallback({
      specifier: './contract',
      context: {},
      nextResolve: (value: string) =>
        Promise.resolve({ url: `file://${value}` }),
    });

    expect(resolved).toEqual({ url: 'file://./contract' });
  });

  it('appends .ts for extensionless relative imports when native resolution fails', async () => {
    const calls: Array<string> = [];
    const resolved = await resolveWithExtensionFallback({
      specifier: './auth',
      context: {},
      nextResolve: (value: string) => {
        calls.push(value);
        if (value === './auth') {
          return Promise.reject(new Error('not found'));
        }
        if (value === './auth.ts') {
          return Promise.resolve({ url: 'file:///tmp/auth.ts' });
        }
        return Promise.reject(new Error('unexpected'));
      },
    });

    expect(calls).toEqual(['./auth', './auth.ts']);
    expect(resolved).toEqual({ url: 'file:///tmp/auth.ts' });
  });

  it('rethrows original errors for bare specifiers', async () => {
    const error = new Error('module missing');

    await expect(
      resolveWithExtensionFallback({
        specifier: 'zod',
        context: {},
        nextResolve: () => Promise.reject(error),
      }),
    ).rejects.toBe(error);
  });
});
