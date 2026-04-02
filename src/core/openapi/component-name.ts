export const componentNameFromContext = (input: {
  operationId: string;
  role: 'params' | 'query' | 'requestBody' | 'responseBody';
  status?: number;
  contentType?: string;
}) => {
  const media = input.contentType?.replace(/[^a-zA-Z0-9]/g, '_');

  return [
    input.operationId,
    input.role,
    input.status ? `s${input.status}` : undefined,
    media,
  ]
    .filter(Boolean)
    .join('_');
};
