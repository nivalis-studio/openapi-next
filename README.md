# @nivalis/openapi-next

Contract-first route tooling for the Next.js App Router with strict Zod validation and OpenAPI 3.1 generation.

## Features

- Define pure route contracts with `defineRouteContract(...)`
- Bind Next.js handlers with `bindContract(contract, handler)`
- Validate params, query, body, and response payloads at runtime
- Generate OpenAPI 3.1 from `src/app/api` contract files
- Run CLI with zero required flags (`openapi-next`)

## Installation

```bash
bun add @nivalis/openapi-next
# or
pnpm add @nivalis/openapi-next
```

> This package declares `next` and `typescript` as peer dependencies. Use versions already installed in your app.

## Creating a contract-backed route

```ts
// src/app/api/users/contract.ts
import { defineRouteContract } from "@nivalis/openapi-next";
import { z } from "zod";

export const listUsersContract = defineRouteContract({
  method: "GET",
  operationId: "listUsers",
  input: {
    query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  },
  responses: {
    200: {
      description: "Users list",
      content: {
        "application/json": {
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
});
```

```ts
// src/app/api/users/route.ts
import { bindContract } from "@nivalis/openapi-next";
import { listUsersContract } from "./contract";

export const GET = bindContract(
  listUsersContract,
  async (_request, _context, input) => ({
    status: 200,
    body: {
      success: true,
      items: await fetchUsers(input.query.page),
    },
  }),
);
```

> **Note:** The `contentType` field is optional and defaults to `'application/json'`. You only need to specify it when returning non-JSON responses (e.g., `'text/plain'`, `'text/csv'`).

## Generating OpenAPI

Use the CLI directly:

```bash
openapi-next
```

This command resolves metadata in this order:

1. CLI flags (`--title`, `--version`, `--description`)
2. `package.json` (`name`, `version`, `description`)
3. Fallback defaults (`API`, `0.1.0`, empty description)

Useful options:

- `--app-dir <path>` (default `src/app/api`)
- `--output <path>` (default `public/openapi.json`)
- `--strict-missing-contracts`

You can also generate from a script:

```ts
import { generateOpenapiSpec } from "@nivalis/openapi-next";

await generateOpenapiSpec({
  title: "Example API",
  version: "1.0.0",
});
```

## Migration guide

See `docs/migrations/v3.md` for breaking changes and migration examples.

## License

MIT © Nivalis Studio
