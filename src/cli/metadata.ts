import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type PackageInfo = {
  name?: string;
  version?: string;
  description?: string;
};

export const resolvePackageInfo = (cwd = process.cwd()): PackageInfo => {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<
      string,
      unknown
    >;

    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
      description:
        typeof parsed.description === 'string' ? parsed.description : undefined,
    };
  } catch {
    return {};
  }
};
