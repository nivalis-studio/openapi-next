# @nivalis/openapi-next

Typed route handlers for the Next.js App Router with strict request and response validation plus OpenAPI 3.1 generation.

## Features

- Define routes with a single `defineRoute` contract used by runtime and OpenAPI generation
- Validate params, query, body, and response payloads with Zod
- Export Next.js handlers directly with `route.next`
- Generate an OpenAPI 3.1 document from `src/app/api/**/route.*` files

## Installation

```bash
bun add @nivalis/openapi-next
# or
pnpm add @nivalis/openapi-next
```

> This package declares `next` and `typescript` as peer dependencies. Use the versions already installed in your application.

## Creating a typed route

```ts
// src/app/api/users/route.ts
import { defineRoute } from '@nivalis/openapi-next';
import { z } from 'zod';

const listUsers = defineRoute({
  method: 'GET',
  operationId: 'listUsers',
  input: {
    query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  },
  responses: {
    200: {
      description: 'Users list',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            items: z.array(
              z.object({
                id: z.string().uuid(),
                email: z.string().email(),
              }),
            ),
          }),
        },
      },
    },
  },
  handler: async ({ query }) => ({
    status: 200,
    contentType: 'application/json',
    body: {
      success: true,
      items: await fetchUsers(query.page),
    },
  }),
});

export const GET = listUsers.next;
```

## Generating an OpenAPI spec

Call `generateOpenapiSpec` from a script or task runner. It scans `src/app/api` and writes `public/openapi.json`.

> CLI generation commands in v3 expect the Bun runtime (for example, `bunx` or `bun run`) so execution matches TypeScript route discovery behavior.

```ts
// scripts/generate-openapi.ts
import { generateOpenapiSpec } from '@nivalis/openapi-next';

await generateOpenapiSpec({
  title: 'Example API',
  description: 'Routes served by the App Router',
  version: '1.0.0',
});
```

Add a package script so the spec can be regenerated on demand or during CI:

```json
{
  "scripts": {
    "openapi": "bunx tsx scripts/generate-openapi.ts"
  }
}
```

## Migration guide

See `docs/migrations/v3.md` for breaking changes and v2-to-v3 examples.

## License

MIT © Nivalis Studio
