import { z } from 'zod';
import { bindContract, defineContract } from './define-route';

const contract = defineContract({
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

const multiContentContract = defineContract({
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

bindContract(contract, async ({ body }, respond) =>
  respond.json(201, { id: body.email }),
);

// @ts-expect-error legacy signature must be rejected
bindContract(contract, async (_request, _context, input) => ({
  status: 201,
  contentType: 'application/json',
  body: { id: input.body.email },
}));

// @ts-expect-error status 200 is not declared by the contract
bindContract(contract, async (_ctx, respond) => respond.json(200, { id: 'x' }));

// @ts-expect-error body does not match declared response schema
bindContract(contract, async (_ctx, respond) => respond.json(201, { id: 123 }));

bindContract(multiContentContract, async (_ctx, respond) =>
  respond.text(200, 'ok'),
);

bindContract(multiContentContract, async (_ctx, respond) =>
  // @ts-expect-error body does not match declared text/plain schema
  respond.text(200, 42),
);

// Test path field is accepted (typed routes integration foundation)
defineContract({
  path: '/api/users/[id]',
  method: 'GET',
  operationId: 'getUser',
  responses: {
    200: {
      description: 'ok',
      content: {
        'application/json': {
          schema: z.object({ id: z.string() }),
        },
      },
    },
  },
});
