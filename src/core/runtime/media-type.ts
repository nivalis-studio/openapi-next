export const normalizeMediaType = (
  contentType: string | null | undefined,
): string => contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';

export const isJsonMediaType = (mediaType: string): boolean =>
  mediaType === 'application/json' || mediaType.endsWith('+json');
