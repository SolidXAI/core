# Testing Module

## Folder Structure
- `contracts/`: metadata + runtime context types
- `core/`: engine, registry, interpolation, utilities
- `adapters/`: API (axios) and UI (Playwright) adapters
- `steps/`: step implementations grouped by domain
- `reporter/`: reporting interfaces + console reporter
- `runner/`: lifecycle helpers + metadata runner

## Scenario Shape (Given/When/Then)
Scenarios live under `TestingMetadata.testing.scenarios`. Steps can be expressed as Cucumber-ish blocks or as flat ops:

```ts
{
  id: "login-happy-path",
  type: "ui",
  steps: [
    { given: { op: "ui.goto", with: { url: "/login" } } },
    { when: { op: "ui.fill", with: { selector: "#user", value: "alice" } } },
    { and: { op: "ui.fill", with: { selector: "#pass", value: "secret" } } },
    { then: { op: "ui.click", with: { selector: "button[type=submit]" } } },
  ],
}
```

## Available Ops
API:
- `api.request`
- `api.auth.bearerFromLogin`

UI:
- `ui.goto`
- `ui.expectUrl`
- `ui.fill`
- `ui.select`
- `ui.click`
- `ui.press`
- `ui.expectVisible`
- `ui.expectText`

Assertions:
- `assert.equals`
- `assert.contains`
- `assert.matches`
- `assert.httpStatus`
- `assert.jsonPath`

Utilities:
- `util.log`
- `util.sleep`

## Add A New Step (SOP)
1. Create a new `*.step.ts` in the right domain folder.
2. Implement a `registerXSteps(registry)` function and `registry.register("op.name", handler)`.
3. Validate required `step.with` fields and throw clear errors.
4. Use adapters via `ctx.api` / `ctx.ui` and update `ctx.last` when helpful.
5. Export and register it from the domain `index.ts`.

## Run From Metadata
```ts
import { runFromMetadata } from "./runner/run-from-metadata";
import metadata from "./testing-metadata.json";

await runFromMetadata({
  metadata,
  includeTags: ["smoke"],
  defaults: { timeoutMs: 30_000, retries: 1 },
  api: { baseUrl: "https://api.example.com" },
  ui: { baseUrl: "https://app.example.com", headless: true },
});
```
