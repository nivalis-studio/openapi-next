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

bindContract(contract, async (_request, _context, input) => ({
  status: 201,
  contentType: 'application/json',
  body: { id: input.body.email },
}));

bindContract(contract, (_request, _context, input) => {
  // @ts-expect-error query is not declared in this contract input
  input.query.page;

  return {
    status: 201,
    contentType: 'application/json',
    body: { id: input.body.email },
  };
});

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
