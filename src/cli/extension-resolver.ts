import path from 'node:path';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

const isRelativeSpecifier = (specifier: string): boolean =>
  specifier.startsWith('./') || specifier.startsWith('../');

const hasExplicitExtension = (specifier: string): boolean =>
  path.extname(specifier) !== '';

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

const resolveCandidates = async ({
  specifier,
  context,
  nextResolve,
  extensions,
  index,
}: {
  specifier: string;
  context: ResolveContext;
  nextResolve: NextResolve;
  extensions: Array<string>;
  index: number;
}): Promise<ResolveResult> => {
  if (index >= extensions.length) {
    throw new Error('No matching extension candidate found.');
  }

  const candidateSpecifier = `${specifier}${extensions[index]}`;

  try {
    return await nextResolve(candidateSpecifier, context);
  } catch (_candidateError) {
    return resolveCandidates({
      specifier,
      context,
      nextResolve,
      extensions,
      index: index + 1,
    });
  }
};

export const resolveWithExtensionFallback = async ({
  specifier,
  context,
  nextResolve,
}: {
  specifier: string;
  context: ResolveContext;
  nextResolve: NextResolve;
}): Promise<ResolveResult> => {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!isRelativeSpecifier(specifier) || hasExplicitExtension(specifier)) {
      throw error;
    }

    try {
      return await resolveCandidates({
        specifier,
        context,
        nextResolve,
        extensions: DEFAULT_EXTENSIONS,
        index: 0,
      });
    } catch {
      throw error;
    }
  }
};
