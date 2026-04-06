import { resolveWithExtensionFallback } from './extension-resolver';

type ResolveContext = Record<string, unknown>;

type ResolveResult = {
  url: string;
  format?: string;
  shortCircuit?: boolean;
};

type NextResolve = (
  specifier: string,
  context: ResolveContext,
) => Promise<ResolveResult>;

export const resolve = (
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
): Promise<ResolveResult> =>
  resolveWithExtensionFallback({
    specifier,
    context,
    nextResolve,
  });
