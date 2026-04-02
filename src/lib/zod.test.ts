import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { getJsonSchema } from './zod';

describe('getJsonSchema', () => {
  it('threads zodToJsonOptions into conversion with enforced io', () => {
    const user = z.object({ id: z.string() });
    const schema = z.object({
      flag: z.stringbool(),
      primary: user,
      secondary: user,
    });

    const json = getJsonSchema({
      schema,
      operationId: 'createUser',
      type: 'input-body',
      zodToJsonOptions: {
        io: 'output',
        reused: 'inline',
      },
    });

    expect(json).toMatchObject({
      properties: {
        flag: { type: 'string' },
        primary: { type: 'object' },
        secondary: { type: 'object' },
      },
    });
  });
});
