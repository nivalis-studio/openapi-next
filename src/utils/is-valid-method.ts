import { VALID_METHODS } from '../methods';
import type { ValidMethod } from '../types/methods';

export const isValidMethod = (x: unknown): x is ValidMethod =>
  VALID_METHODS.includes(x as ValidMethod);
