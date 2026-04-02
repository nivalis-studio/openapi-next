import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { toRequestJsonSchema, toResponseJsonSchema } from './json-schema';

describe('json-schema conversion', () => {
  it('uses input mode for request schema conversion', () => {
    const schema = z.stringbool();

    const json = toRequestJsonSchema(schema, {
      operationId: 'createMeasurement',
      routePath: '/measurements',
      method: 'POST',
      role: 'requestBody',
    });

    expect(json).toMatchObject({ type: 'string' });
  });

  it('uses output mode for response schema conversion', () => {
    const schema = z.stringbool();

    const json = toResponseJsonSchema(schema, {
      operationId: 'createMeasurement',
      routePath: '/measurements',
      method: 'POST',
      role: 'responseBody',
    });

    expect(json).toMatchObject({ type: 'boolean' });
  });

  it('honors caller options while enforcing request io mode', () => {
    const user = z.object({ id: z.string() });
    const schema = z.object({ primary: user, secondary: user });

    const json = toRequestJsonSchema(
      schema,
      {
        operationId: 'createUser',
        routePath: '/users',
        method: 'POST',
        role: 'requestBody',
      },
      {
        io: 'output',
        reused: 'inline',
      },
    );

    expect(json).toMatchObject({
      properties: {
        primary: { type: 'object' },
        secondary: { type: 'object' },
      },
    });
  });

  it('converts with draft-2020-12 and ref behavior', () => {
    const user = z.object({ id: z.string() });
    type Node = { name: string; children: Array<Node> };
    const nodeSchema: z.ZodType<Node> = z.lazy(() =>
      z.object({
        name: z.string(),
        children: z.array(nodeSchema),
      }),
    );
    const schema = z.object({
      primary: user,
      secondary: user,
      root: nodeSchema,
    });

    const json = toResponseJsonSchema(schema, {
      operationId: 'getUserTree',
      routePath: '/users/tree',
      method: 'GET',
      role: 'responseBody',
    });

    expect(json).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      properties: {
        primary: { $ref: '#/$defs/__schema0' },
        secondary: { $ref: '#/$defs/__schema0' },
        root: { $ref: '#/$defs/__schema1' },
      },
    });
    expect(json).toHaveProperty(
      '$defs.__schema1.properties.children.items.$ref',
      '#/$defs/__schema1',
    );
  });

  it('throws conversion errors with SCHEMA_CONVERSION_FAILED context', () => {
    const bad = z.date();

    expect(() =>
      toResponseJsonSchema(bad, {
        operationId: 'listUsers',
        routePath: '/users',
        method: 'GET',
        role: 'responseBody',
      }),
    ).toThrow('SCHEMA_CONVERSION_FAILED');

    try {
      toResponseJsonSchema(bad, {
        operationId: 'listUsers',
        routePath: '/users',
        method: 'GET',
        role: 'responseBody',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain('SCHEMA_CONVERSION_FAILED');
      expect(message).toContain('listUsers');
      expect(message).toContain('GET');
      expect(message).toContain('/users');
      expect(message).toContain('responseBody');
    }
  });
});
