# @nivalis/openapi-next

Typed route handlers for the Next.js App Router with automatic request validation, response typing, and OpenAPI spec generation.

## Features

- Build strongly-typed `route.ts` handlers with declarative `input`/`output` chains
- Validate bodies, queries, params, and content types with Zod before your action runs
- Generate consistent success/error payloads with helpers such as `openapiSuccess` and `openapiFailure`
- Emit an OpenAPI 3.1 document by scanning `src/app/api/**/route.*` files (ts/js/tsx/jsx/mjs/cjs)

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
import { route, getOpenapiOutputs } from "@nivalis/openapi-next";
import { httpStatus } from "@nivalis/std";
import { z } from "zod";

const UsersSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      email: z.string().email(),
    }),
  ),
});

const listUsers = route({
  method: "GET",
  operationId: "listUsers",
})
  .input({
    query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  })
  .outputs(
    getOpenapiOutputs(UsersSchema, [
      httpStatus.badRequest,
      httpStatus.notFound,
    ]),
  );

export const GET = listUsers.action(async ({ query }) => {
  const data = await fetchUsers(query.page);
  return Response.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...data,
  });
});
```

## Generating an OpenAPI spec

Call `generateOpenapiSpec` from a script or task runner. It walks `src/app/api` and writes `public/openapi.json` when it finds handlers exported from `route.*` files.

```ts
// scripts/generate-openapi.ts
import { generateOpenapiSpec } from "@nivalis/openapi-next";

await generateOpenapiSpec(
  {
    title: "Example API",
    description: "Routes served by the App Router",
    version: "1.0.0",
  },
  {
    openApiObject: {
      info: {
        contact: { name: "Platform Team", email: "platform@example.com" },
      },
      servers: [{ url: "https://api.example.com" }],
    },
  },
);
```

Add a package script so the spec can be regenerated on demand or during CI:

```json
{
  "scripts": {
    "openapi": "bunx tsx scripts/generate-openapi.ts"
  }
}
```

`generateOpenapiSpec` accepts optional `zodToJsonOptions` when you need to customize how Zod schemas become JSON Schema.

## License

MIT © Nivalis Studio
