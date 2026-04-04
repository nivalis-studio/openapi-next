# ESM-only BindContract DX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a major release that keeps Effect and contract-first guarantees, replaces `bindContract` with a new object-context signature, removes compatibility metadata, and publishes ESM-only package exports.

**Architecture:** Keep the contract-first model (`defineRouteContract`) as the source of truth and make `bindContract` the ergonomic boundary by passing validated inputs as a single context object plus typed response helpers. Preserve Effect as runtime execution engine but make execution flow linear and reuse media-type utilities across input/output validation. Remove compatibility-era surface and package the library as ESM-only.

**Tech Stack:** TypeScript, Bun test runner, Effect, Zod, OpenAPI 3.1 generation, Node CLI.

---

## File Structure

### Create

- `src/core/runtime/respond.ts` - typed response helper factory used by the new `bindContract` handler signature.
- `src/core/runtime/media-type.ts` - shared media-type normalization and JSON-media detection utilities.
- `src/core/runtime/media-type.test.ts` - unit tests for shared media-type helpers.
- `src/core/openapi/package-contract.test.ts` - package contract tests for ESM-only exports and CLI shebang.

### Modify

- `src/core/contract.ts` - new handler context/responder types and removal of compatibility handler metadata types.
- `src/core/define-route.ts` - `bindContract` signature update and removal of `_route` assignment.
- `src/next/create-next-handler.ts` - runtime handler bridge simplified without `_generateOpenApi` compatibility helper.
- `src/core/runtime/execute-route.ts` - linear Effect pipeline and new handler invocation shape.
- `src/core/runtime/validate-input.ts` - reuse shared media-type utility.
- `src/core/runtime/validate-output.ts` - reuse shared media-type utility.
- `src/core/bind-contract.typecheck.ts` - type tests for the new callback signature and responder typing.
- `src/core/define-route.test.ts` - runtime tests updated to object-context callback shape.
- `src/next/create-next-handler.test.ts` - remove compatibility metadata expectations.
- `src/core/runtime/execute-route.test.ts` - add responder-based runtime behavior tests.
- `src/core/runtime/validate-input.test.ts` - keep behavior assertions intact after utility refactor.
- `src/core/runtime/validate-output.test.ts` - keep behavior assertions intact after utility refactor.
- `src/core/openapi/docs-contract.test.ts` - docs assertions updated for new callback shape.
- `src/cli/bin.ts` - Node shebang for ESM-first CLI execution.
- `README.md` - update canonical examples to new `bindContract` callback shape.
- `package.json` - ESM-only exports and removal of CJS conditions.

### Remove (if unused after refactor)

- `src/utils/is-valid-method.ts`
- `src/utils/capitalize.ts`
- `src/lib/content-type.ts`
- `src/types/operation.ts`

Only remove these files if `bun run ts` confirms no remaining references.

---

### Task 1: Redesign `bindContract` Type Surface

**Files:**

- Modify: `src/core/contract.ts`
- Modify: `src/core/define-route.ts`
- Test: `src/core/bind-contract.typecheck.ts`

- [ ] **Step 1: Write the failing type test for new callback signature**

```ts
// Add to src/core/bind-contract.typecheck.ts

bindContract(contract, async ({ body }, respond) =>
  respond.json(201, { id: body.email }),
);

// @ts-expect-error legacy signature must be rejected in next major
bindContract(contract, async (_request, _context, input) => ({
  status: 201,
  contentType: "application/json",
  body: { id: input.body.email },
}));
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `bun run ts`
Expected: FAIL with type errors in `src/core/bind-contract.typecheck.ts` because the old handler model is still active.

- [ ] **Step 3: Implement new context/responder handler types**

```ts
// Replace handler-facing types in src/core/contract.ts

export type ContractStatusesWithMedia<
  TContract extends RouteContract,
  TMedia extends string,
> = Extract<
  {
    [Status in ResponseStatuses<TContract>]: TMedia extends ResponseContentTypes<
      TContract,
      Status
    >
      ? Status
      : never;
  }[ResponseStatuses<TContract>],
  number
>;

export type ContractResponseByStatusAndMedia<
  TContract extends RouteContract,
  TStatus extends ResponseStatuses<TContract>,
  TMedia extends ResponseContentTypes<TContract, TStatus>,
> = {
  status: TStatus;
  contentType?: TMedia;
  body: ResponseBody<TContract, TStatus, TMedia>;
  headers?: RouteHeaders;
};

export type BoundRouteContext<TContract extends RouteContract> = {
  request: Request;
  params: RouteInputData<TContract>["params"];
  query: RouteInputData<TContract>["query"];
  body: RouteInputData<TContract>["body"];
};

export type BoundRouteResponder<TContract extends RouteContract> = {
  json: <
    TStatus extends ContractStatusesWithMedia<TContract, "application/json">,
  >(
    status: TStatus,
    body: ContractResponseByStatusAndMedia<
      TContract,
      TStatus,
      "application/json"
    >["body"],
    headers?: RouteHeaders,
  ) => ContractResponseByStatusAndMedia<TContract, TStatus, "application/json">;
  text: <TStatus extends ContractStatusesWithMedia<TContract, "text/plain">>(
    status: TStatus,
    body: ContractResponseByStatusAndMedia<
      TContract,
      TStatus,
      "text/plain"
    >["body"],
    headers?: RouteHeaders,
  ) => ContractResponseByStatusAndMedia<TContract, TStatus, "text/plain">;
};

export type BoundRouteHandler<TContract extends RouteContract> = (
  context: BoundRouteContext<TContract>,
  respond: BoundRouteResponder<TContract>,
) =>
  | Promise<ContractRouteHandlerResult<TContract>>
  | ContractRouteHandlerResult<TContract>;
```

- [ ] **Step 4: Update `bindContract` signature to compile with the new handler type**

```ts
// Replace bindContract declaration in src/core/define-route.ts

export const bindContract = <TContract extends RouteContract>(
  contract: TContract,
  handler: BoundRouteHandler<TContract>,
) => createNextHandler(contract, handler);
```

- [ ] **Step 5: Run typecheck to verify it passes**

Run: `bun run ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/contract.ts src/core/define-route.ts src/core/bind-contract.typecheck.ts
git commit -m "feat: redesign bindContract handler context and response typing"
```

### Task 2: Add Typed Responder Helpers and Wire Runtime Invocation

**Files:**

- Create: `src/core/runtime/respond.ts`
- Modify: `src/core/runtime/execute-route.ts`
- Test: `src/core/runtime/execute-route.test.ts`

- [ ] **Step 1: Write the failing runtime test for responder usage**

```ts
// Add to src/core/runtime/execute-route.test.ts

it("supports object-context handler and respond.json helper", async () => {
  const response = await executeRoute(
    {
      method: "GET",
      operationId: "respond-helper-json",
      input: {
        query: z.object({ page: z.coerce.number().int().min(1) }),
      },
      responses: {
        200: {
          description: "ok",
          content: {
            "application/json": {
              schema: z.object({ echo: z.string() }),
            },
          },
        },
      },
    },
    ({ query }, respond) => respond.json(200, { echo: `page:${query.page}` }),
    new Request("https://api.test/items?page=2", { method: "GET" }),
    { params: Promise.resolve({}) },
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ echo: "page:2" });
});
```

- [ ] **Step 2: Run runtime tests to verify failure**

Run: `bun test src/core/runtime/execute-route.test.ts`
Expected: FAIL because `executeRoute` still calls the old three-argument handler signature.

- [ ] **Step 3: Implement `respond` helper factory**

```ts
// Create src/core/runtime/respond.ts
import type {
  BoundRouteResponder,
  ContractRouteHandlerResult,
  RouteContract,
  RouteHeaders,
} from "../contract";

const toHeaders = (
  headers: RouteHeaders | undefined,
): RouteHeaders | undefined => headers;

export const createResponder = <
  TContract extends RouteContract,
>(): BoundRouteResponder<TContract> => ({
  json: (status, body, headers) =>
    ({
      status,
      contentType: "application/json",
      body,
      headers: toHeaders(headers),
    }) as ContractRouteHandlerResult<TContract>,
  text: (status, body, headers) =>
    ({
      status,
      contentType: "text/plain",
      body,
      headers: toHeaders(headers),
    }) as ContractRouteHandlerResult<TContract>,
});
```

- [ ] **Step 4: Invoke route handlers with new context + responder**

```ts
// Replace handler invocation block in src/core/runtime/execute-route.ts

const result =
  yield *
  Effect.tryPromise({
    try: () =>
      Promise.resolve(
        routeHandler(
          {
            request,
            params: input.data.params as RouteInputData<TContract>["params"],
            query: input.data.query as RouteInputData<TContract>["query"],
            body: input.data.body as RouteInputData<TContract>["body"],
          },
          createResponder<TContract>(),
        ),
      ),
    catch: (error): ExecutionError => ({
      _tag: "HandlerError",
      error,
    }),
  });
```

- [ ] **Step 5: Run runtime tests to verify pass**

Run: `bun test src/core/runtime/execute-route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/runtime/respond.ts src/core/runtime/execute-route.ts src/core/runtime/execute-route.test.ts
git commit -m "feat: add typed responder helpers for bindContract handlers"
```

### Task 3: Remove Compatibility Metadata from Bound Handlers

**Files:**

- Modify: `src/next/create-next-handler.ts`
- Modify: `src/core/define-route.ts`
- Modify: `src/core/contract.ts`
- Test: `src/next/create-next-handler.test.ts`

- [ ] **Step 1: Write failing tests that require metadata removal**

```ts
// Replace metadata tests in src/next/create-next-handler.test.ts

it("does not expose _generateOpenApi compatibility helper", () => {
  const contract = defineRouteContract({
    method: "GET",
    operationId: "health-no-meta",
    responses: {
      200: {
        description: "ok",
        content: {
          "application/json": {
            schema: z.object({ ok: z.literal(true) }),
          },
        },
      },
    },
  });

  const GET = bindContract(contract, (_ctx, respond) =>
    respond.json(200, { ok: true as const }),
  );

  expect("_generateOpenApi" in GET).toBe(false);
  expect("_route" in GET).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/next/create-next-handler.test.ts`
Expected: FAIL because compatibility metadata is still present.

- [ ] **Step 3: Remove compatibility fields from implementation and types**

```ts
// Replace src/next/create-next-handler.ts
import { executeRoute } from "../core/runtime/execute-route";
import type {
  BoundRouteHandler,
  NextRouteHandler,
  RouteContract,
} from "../core/contract";

export const createNextHandler =
  <TContract extends RouteContract>(
    contract: TContract,
    routeHandler: BoundRouteHandler<TContract>,
  ): NextRouteHandler =>
  async (request: Request, context: { params: Promise<unknown> }) =>
    executeRoute(contract, routeHandler, request, context);
```

```ts
// Replace NextRouteHandler type in src/core/contract.ts
export type NextRouteHandler = (
  request: Request,
  context: { params: Promise<unknown> },
) => Promise<Response>;
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun test src/next/create-next-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/next/create-next-handler.ts src/core/contract.ts src/core/define-route.ts src/next/create-next-handler.test.ts
git commit -m "refactor: remove compatibility metadata from bound handlers"
```

### Task 4: Introduce Shared Media-Type Utility and Linearize Runtime Pipeline

**Files:**

- Create: `src/core/runtime/media-type.ts`
- Create: `src/core/runtime/media-type.test.ts`
- Modify: `src/core/runtime/execute-route.ts`
- Modify: `src/core/runtime/validate-input.ts`
- Modify: `src/core/runtime/validate-output.ts`

- [ ] **Step 1: Write failing unit tests for media-type utility**

```ts
// Create src/core/runtime/media-type.test.ts
import { describe, expect, it } from "bun:test";
import { isJsonMediaType, normalizeMediaType } from "./media-type";

describe("media-type utility", () => {
  it("normalizes media type and strips parameters", () => {
    expect(normalizeMediaType("Application/JSON; charset=utf-8")).toBe(
      "application/json",
    );
  });

  it("detects +json subtypes as json media", () => {
    expect(isJsonMediaType("application/problem+json")).toBe(true);
  });

  it("returns false for non-json media", () => {
    expect(isJsonMediaType("text/plain")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test src/core/runtime/media-type.test.ts`
Expected: FAIL because `src/core/runtime/media-type.ts` does not exist yet.

- [ ] **Step 3: Implement shared media-type utility**

```ts
// Create src/core/runtime/media-type.ts
export const normalizeMediaType = (
  contentType: string | null | undefined,
): string => contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";

export const isJsonMediaType = (mediaType: string): boolean =>
  mediaType === "application/json" || mediaType.endsWith("+json");
```

- [ ] **Step 4: Refactor runtime files to use utility and linear stage names**

```ts
// Representative replacement in src/core/runtime/execute-route.ts
// - remove local isJsonContentType helper
// - import { isJsonMediaType, normalizeMediaType } from './media-type'
// - rename internals to decodeInputEffect/invokeHandlerEffect/validateOutputEffect/toHttpResponseEffect
// - keep Effect.runPromise as external boundary

import { isJsonMediaType, normalizeMediaType } from "./media-type";

const contentType = result.contentType ?? "application/json";
const normalized = normalizeMediaType(contentType);

if (isJsonMediaType(normalized)) {
  return Response.json(output.body, {
    status: result.status,
    headers,
  });
}
```

- [ ] **Step 5: Run focused runtime tests**

Run: `bun test src/core/runtime/validate-input.test.ts src/core/runtime/validate-output.test.ts src/core/runtime/execute-route.test.ts src/core/runtime/media-type.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/runtime/media-type.ts src/core/runtime/media-type.test.ts src/core/runtime/execute-route.ts src/core/runtime/validate-input.ts src/core/runtime/validate-output.ts
git commit -m "refactor: share media-type utilities across runtime validation"
```

### Task 5: Enforce ESM-only Package Contract and Node CLI Shebang

**Files:**

- Create: `src/core/openapi/package-contract.test.ts`
- Modify: `package.json`
- Modify: `src/cli/bin.ts`

- [ ] **Step 1: Write failing package contract test**

```ts
// Create src/core/openapi/package-contract.test.ts
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("package contract", () => {
  it("publishes ESM-only exports", () => {
    const pkgPath = resolve(import.meta.dir, "../../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      exports?: Record<string, unknown>;
      main?: string;
      module?: string;
    };

    const rootExport = pkg.exports?.["."] as Record<string, string> | undefined;

    expect(pkg.main).toBeUndefined();
    expect(pkg.module).toBeUndefined();
    expect(rootExport?.require).toBeUndefined();
    expect(rootExport?.import ?? rootExport?.default).toBeDefined();
  });

  it("uses node shebang in CLI entry", () => {
    const cliPath = resolve(import.meta.dir, "../../cli/bin.ts");
    const cli = readFileSync(cliPath, "utf8");

    expect(cli.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test src/core/openapi/package-contract.test.ts`
Expected: FAIL because package still has CJS conditions and CLI shebang is Bun.

- [ ] **Step 3: Implement ESM-only exports and Node CLI shebang**

```json
// Replace package entrypoint fields in package.json
{
  "type": "module",
  "bin": {
    "openapi-next": "dist/cli/bin.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./cli/bin": {
      "types": "./dist/cli/bin.d.ts",
      "default": "./dist/cli/bin.js"
    }
  }
}
```

```ts
// Replace shebang in src/cli/bin.ts
#!/usr/bin/env node
```

- [ ] **Step 4: Run package contract and build checks**

Run: `bun test src/core/openapi/package-contract.test.ts && bun run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json src/cli/bin.ts src/core/openapi/package-contract.test.ts
git commit -m "feat: publish esm-only exports and node cli entrypoint"
```

### Task 6: Update Public Documentation and Docs Contract Tests

**Files:**

- Modify: `README.md`
- Modify: `src/core/openapi/docs-contract.test.ts`

- [ ] **Step 1: Write failing docs contract assertions for new API**

```ts
// Add to src/core/openapi/docs-contract.test.ts

it("README uses object-context bindContract handler signature", () => {
  const readme = readFileSync(readmePath, "utf8");

  expect(readme.includes("async (_request, _context, input)")).toBe(false);
  expect(readme.includes("async ({ query })")).toBe(true);
});
```

- [ ] **Step 2: Run docs contract tests to verify failure**

Run: `bun test src/core/openapi/docs-contract.test.ts`
Expected: FAIL because README still documents the legacy callback shape.

- [ ] **Step 3: Update README examples to new handler API**

```ts
// Replace the route example block in README.md
export const GET = bindContract(listUsersContract, async ({ query }, respond) =>
  respond.json(200, {
    success: true,
    items: await fetchUsers(query.page),
  }),
);
```

- [ ] **Step 4: Re-run docs contract tests**

Run: `bun test src/core/openapi/docs-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md src/core/openapi/docs-contract.test.ts
git commit -m "docs: update bindContract examples to object-context signature"
```

### Task 7: Remove Dead Legacy Files If Unreferenced

**Files:**

- Delete (conditional): `src/utils/is-valid-method.ts`
- Delete (conditional): `src/utils/capitalize.ts`
- Delete (conditional): `src/lib/content-type.ts`
- Delete (conditional): `src/types/operation.ts`

- [ ] **Step 1: Verify candidate files are unreferenced**

Run: `bun run ts`
Expected: PASS before deletion.

Run: `bunx rg "is-valid-method|capitalizeFirstLetter|parseContentType|TypedNextResponseType|TypedRouteHandler|RouteOperationDefinition" src`
Expected: no live imports from runtime/public entrypoint code.

- [ ] **Step 2: Delete confirmed-dead files**

```bash
rm src/utils/is-valid-method.ts src/utils/capitalize.ts src/lib/content-type.ts src/types/operation.ts
```

- [ ] **Step 3: Re-run typecheck and tests after deletion**

Run: `bun run ts && bun test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused legacy utility and type modules"
```

### Task 8: Full Verification and Release Readiness Check

**Files:**

- Modify: none expected

- [ ] **Step 1: Run complete verification suite**

Run: `bun run ts && bun test && bun run build`
Expected: all commands PASS.

- [ ] **Step 2: Validate ESM-only package shape from repository state**

Run: `node -e "const p=require('./package.json'); console.log(Boolean(p.exports?.['.']?.require), p.main, p.module)"`
Expected: `false undefined undefined`.

- [ ] **Step 3: Confirm working tree is clean and ready for release PR**

Run: `git status --short`
Expected: empty output.

- [ ] **Step 4: Final commit for any release-note or tiny follow-up edits**

```bash
git add -A
git commit -m "chore: finalize esm-only bindContract dx redesign"
```

---

## Spec Coverage Check

- Contract-first preserved: Tasks 1, 2, 6.
- Effect preserved with runtime simplification: Task 4.
- New `bindContract` object-context signature only: Tasks 1, 2, 6.
- Remove `_generateOpenApi` and `_route`: Task 3.
- ESM-only packaging and Node CLI runtime: Task 5.
- Cleanup of legacy surface: Task 7.
- Verification gates: Task 8.

## Placeholder Scan

- No placeholder markers (`TBD`, `TODO`, `implement later`) remain.
- Every code-changing task includes concrete snippets.
- Every verification step includes explicit commands and expected outcomes.

## Type Consistency Check

- `BoundRouteContext`, `BoundRouteResponder`, and new `bindContract` callback shape are used consistently across type, runtime, and docs tasks.
- `respond.json` and `respond.text` helper names are consistent in type tests, runtime tests, and README examples.
- Removal of metadata (`_generateOpenApi`, `_route`) is reflected in both implementation and tests.
