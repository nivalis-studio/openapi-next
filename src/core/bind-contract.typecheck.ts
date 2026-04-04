import { z } from 'zod';
import { bindContract, defineRouteContract } from './define-route';

const contract = defineRouteContract({
  method: 'POST',
  operationId: 'createUser',
  input: { body: z.object({ email: z.email() }) },
  responses: {
    201: {
      description: 'created',
      content: {
        'application/json': {
          schema: z.object({ id: z.string() }),
        },
      },
    },
  },
});

// @ts-expect-error legacy signature - old tests will be migrated
bindContract(contract, async (_request, _context, input) => ({
  status: 201,
  contentType: 'application/json',
  body: { id: input.body.email },
}));

// @ts-expect-error status 200 is not declared by the contract
bindContract(contract, async () => ({
  status: 200,
  contentType: 'application/json',
  body: { id: 'x' },
}));

const multiContentContract = defineRouteContract({
  method: 'GET',
  operationId: 'multiContent',
  responses: {
    200: {
      description: 'ok',
      content: {
        'application/json': {
          schema: z.object({ kind: z.literal('json') }),
        },
        'text/plain': {
          schema: z.string(),
        },
      },
    },
  },
});

// @ts-expect-error body does not match declared text/plain schema
bindContract(multiContentContract, async () => ({
  status: 200,
  contentType: 'text/plain',
  body: { kind: 'json' },
}));

// Test new signature with context/responder pattern
bindContract(contract, async ({ body }, respond) =>
  respond.json(201, { id: body.email }),
);

// @ts-expect-error legacy signature must be rejected in next major
bindContract(contract, async (_request, _context, input) => ({
  status: 201,
  contentType: 'application/json',
  body: { id: input.body.email },
}));
