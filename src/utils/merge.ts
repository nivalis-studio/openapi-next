export const merge = <T>(...objects: T[]): T =>
  objects.reduce((acc, object) => ({ ...acc, ...object }));
