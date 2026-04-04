# OpenAPI Next DX Redesign (ESM-only, Contract-first, Effect-preserving)

Date: 2026-04-04
Status: Approved for planning
Owner: openapi-next maintainers

## 1. Context

`@nivalis/openapi-next` is already contract-first and provides strong runtime validation and OpenAPI generation. The next major release focuses on reducing developer friction and package complexity while preserving core guarantees.

Current strengths:

- Contract-first route definition and binding (`defineRouteContract`, `bindContract`)
- Runtime validation of params/query/body and response payloads
- OpenAPI generation from contract files
- Effect-based runtime implementation

Current pain points:

- Handler ergonomics are verbose and context typing is awkward (`context.params: Promise<unknown>`)
- Public API includes compatibility-era surface (`_generateOpenApi`, `_route`) that is no longer desired
- Dual CJS/ESM packaging increases maintenance and export/type complexity
- Some legacy/unused type and utility surface increases maintenance burden

## 2. Goals

1. Preserve contract-first guarantees as the primary product value.
2. Keep `Effect` as the runtime foundation.
3. Improve route authoring DX by simplifying `bindContract` handler ergonomics.
4. Ship ESM-only package output in the next major release.
5. Reduce compatibility and legacy surface in runtime/public API.

## 3. Non-goals

- Preserve backward compatibility with old handler signatures.
- Provide bridge release behavior.
- Maintain CJS distribution artifacts.
- Maintain compatibility helper properties on bound handlers.

## 4. Product decisions

### 4.1 Keep contract-first as source of truth

`defineRouteContract(...)` remains the canonical way to define route input/output schemas and OpenAPI metadata.

### 4.2 Keep `bindContract` as the single handler binding API

No additional route builder entrypoint is introduced. We simplify and modernize `bindContract` directly.

New callback shape (new major, only supported signature):

```ts
bindContract(contract, async ({ request, params, query, body }, respond) => {
  return respond.json(200, { ok: true });
});
```

### 4.3 Remove legacy handler signature

The previous callback signature is removed:

```ts
bindContract(contract, async (request, context, input) => { ... });
```

### 4.4 Remove compatibility-era metadata on handler functions

Bound handlers no longer expose compatibility metadata properties:

- `_generateOpenApi`
- `_route`

### 4.5 ESM-only distribution

Next major release ships ESM-only package output and export map. CJS artifacts and CJS export conditions are removed.

### 4.6 No migration or compatibility track

This release intentionally draws a clear major boundary. No migration/compatibility layer is part of scope.

## 5. Public API design

## 5.1 `defineRouteContract`

No conceptual changes. Continues to define:

- HTTP method
- operationId
- optional input schema set (`params`, `query`, `body`, `contentType`)
- response schema map by status/content type

## 5.2 `bindContract`

`bindContract` takes:

1. a contract
2. a handler callback with destructured validated context

Proposed callback contract:

```ts
type BoundContext<TContract extends RouteContract> = {
  request: Request;
  params: RouteInputData<TContract>["params"];
  query: RouteInputData<TContract>["query"];
  body: RouteInputData<TContract>["body"];
};

type JsonResponseOf<
  TContract extends RouteContract,
  TStatus extends number,
> = ContractResponseByStatusAndMedia<TContract, TStatus, "application/json">;

type TextResponseOf<
  TContract extends RouteContract,
  TStatus extends number,
> = ContractResponseByStatusAndMedia<TContract, TStatus, "text/plain">;

type Respond<TContract extends RouteContract> = {
  json: <
    TStatus extends ContractStatusesWithMedia<TContract, "application/json">,
  >(
    status: TStatus,
    body: JsonResponseOf<TContract, TStatus>["body"],
    headers?: HeadersInit,
  ) => JsonResponseOf<TContract, TStatus>;
  text: <TStatus extends ContractStatusesWithMedia<TContract, "text/plain">>(
    status: TStatus,
    body: TextResponseOf<TContract, TStatus>["body"],
    headers?: HeadersInit,
  ) => TextResponseOf<TContract, TStatus>;
  // Optional future helpers for other media types
};
```

Notes:

- `params`, `query`, and `body` are pre-validated and typed.
- Default JSON behavior remains (if JSON helper is used, media type is handled consistently).
- Response helpers enforce contract-declared status/media/body combinations at type level.

### 5.3 `generateOpenapiSpec` and CLI

OpenAPI generation remains contract-file-driven and behaviorally equivalent at feature level.

CLI remains available as `openapi-next` with feature parity for:

- default metadata resolution
- app dir and output selection
- strict missing contracts mode
- warnings for coverage/mismatch

## 6. Runtime architecture (Effect kept)

Runtime stays Effect-based, but internals are made more linear and explicit.

Target pipeline:

1. `decodeInputEffect`
2. `invokeHandlerEffect`
3. `validateOutputEffect`
4. `toHttpResponseEffect`

### 6.1 Error model

Use explicit tagged domain errors for runtime stages:

- `InputError`
- `OutputError`
- `UnhandledHandlerError`

Centralize mapping from domain errors to HTTP responses to avoid duplicated mapping branches.

### 6.2 Media type normalization

Use shared media-type normalization utilities across input and output validation to avoid drift in edge-case handling (`application/*+json`, charset suffixes, etc.).

### 6.3 External behavior invariants

Keep these guarantees unchanged:

- Input validation runs before handler invocation
- Output validation runs on handler result
- Response validation failures map to internal server error response semantics
- Handler exceptions are sanitized in public responses

## 7. Packaging and distribution

## 7.1 ESM-only package

- Keep package `type: module`
- Remove CJS main/export conditions
- Remove generated `.cjs` and CJS-specific declaration artifacts
- Keep a single ESM export path and corresponding type output

### 7.2 CLI runtime

CLI remains first-class and should execute in modern Node environments without Bun-only assumptions.

## 8. Files and surface likely affected

Primary implementation targets:

- `src/core/contract.ts`
- `src/core/define-route.ts`
- `src/next/create-next-handler.ts`
- `src/core/runtime/execute-route.ts`
- `src/core/runtime/validate-input.ts`
- `src/core/runtime/validate-output.ts`
- `src/index.ts`
- `src/cli/*`
- `package.json`

Cleanup candidates (remove or narrow if no longer needed after API redesign):

- legacy compatibility helpers and types tied to removed signatures
- compatibility-only bound handler metadata shape
- unused utility/type modules discovered during implementation

## 9. Testing strategy

## 9.1 Runtime tests

Retain and adapt behavior tests for:

- input validation failures
- output validation failures
- JSON/non-JSON response handling
- sanitized error output

## 9.2 API/type tests

Add or adapt type-level tests for:

- inferred `params/query/body` in new `bindContract` callback context
- compile-time enforcement of response status/media/body combinations in `respond` helpers
- rejection of undeclared response combinations

## 9.3 CLI and OpenAPI tests

Retain generation and coverage tests and ensure ESM-only packaging does not change expected generation behavior.

## 10. Release acceptance criteria

1. All route binding examples and tests use the new `bindContract` callback signature only.
2. No `_generateOpenApi` or `_route` behavior remains in public bound handlers.
3. Dist and export map are ESM-only.
4. Runtime still uses Effect.
5. Contract-first behavior and OpenAPI generation parity are preserved.
6. Test suite passes with updated API and packaging assumptions.

## 11. Risks and mitigations

- Risk: Type complexity in `respond` helpers can regress inference.
  - Mitigation: incremental type test additions for each helper and status/media branch.
- Risk: Removing compatibility metadata may impact internal assumptions.
  - Mitigation: delete/replace references in tests and generator paths explicitly.
- Risk: ESM-only packaging can surface tooling edge cases.
  - Mitigation: verify package entrypoints and CLI execution in modern Node CI matrix.

## 12. Implementation order (high level)

1. Redesign core `bindContract` types and handler callback shape.
2. Add typed `respond` helper model and runtime response adapter.
3. Remove compatibility metadata and legacy callback signature.
4. Refactor runtime into linear Effect pipeline while preserving behavior.
5. Convert package exports/dist to ESM-only.
6. Update tests and docs to new canonical API and packaging model.
