# @nivalis/openapi-next

Contract-first route tooling for the Next.js App Router with compile-time response typing and OpenAPI 3.1 generation.

## Features

- Define pure route contracts with `defineContract(...)`
- Bind Next.js handlers with `bindContract(contract, handler)`
- Validate params, query, and body at runtime
- Enforce response status/content/body correctness at compile time via typed `respond` helpers
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
import { defineContract } from "@nivalis/openapi-next";
import { z } from "zod";

export const listUsersContract = defineContract({
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

export const GET = bindContract(listUsersContract, async ({ query }, respond) =>
  respond.json(200, {
    success: true,
    items: await fetchUsers(query.page),
  }),
);
```

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

## Troubleshooting

### Next build fails on `extension-resolver-loader.ts`

If Turbopack fails while bundling `@nivalis/openapi-next` with an error like:

```text
Module not found: Can't resolve './extension-resolver-loader.ts'
```

add this to your `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@nivalis/openapi-next"],
};

export default nextConfig;
```

This keeps Next from bundling the package internals during app build.

## Migration guide

See `docs/migrations/v3.md` for breaking changes and migration examples.

## Roadmap

- Optional runtime response validation mode for debugging and stricter runtime guarantees.

## License

MIT © Nivalis Studio
