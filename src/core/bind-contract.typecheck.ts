import { z } from 'zod';
import { HTTP_STATUS } from '../lib/http';
import { bindContract, defineContract } from './define-route';

const CREATED_STATUS = HTTP_STATUS.created;
const OK_STATUS = HTTP_STATUS.ok;
const INVALID_NUMBER_ID = 123;
const INVALID_TEXT_BODY = 42;

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
  respond.json(CREATED_STATUS, { id: body.email }),
);

// @ts-expect-error legacy signature must be rejected
bindContract(contract, async (_request, _context, input) => ({
  status: CREATED_STATUS,
  contentType: 'application/json',
  body: { id: input.body.email },
}));

bindContract(contract, async (_ctx, respond) =>
  // @ts-expect-error status 200 is not declared by the contract
  respond.json(OK_STATUS, { id: 'x' }),
);

bindContract(contract, async (_ctx, respond) =>
  // @ts-expect-error body does not match declared response schema
  respond.json(CREATED_STATUS, { id: INVALID_NUMBER_ID }),
);

bindContract(multiContentContract, async (_ctx, respond) =>
  respond.text(OK_STATUS, 'ok'),
);

bindContract(multiContentContract, async (_ctx, respond) =>
  // @ts-expect-error body does not match declared text/plain schema
  respond.text(OK_STATUS, INVALID_TEXT_BODY),
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
