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

Custom:
- `test.spec`

## Interpolation
Available tokens:
- `${env:NAME}` (environment variables)
- `${params.foo}` (scenario params)
- `${res:saveAs.path}` (saved step results)
- `${data.modelUserKey["recUserKeyValue"].field}` (test data from `testing.data`)
- `${data.modelUserKey["recUserKeyValue"]._rec}` (raw record object when used alone)

Test data lookup details:
- Data is indexed as `data.<modelUserKey>["<recUserKeyValue>"]`.
- You can access fields with `.fieldName`.
- Bracket syntax is recommended for keys with spaces or punctuation.
- Use `._rec` to return the full object when the token is the entire value.

Examples:
```json
{
  "params": {
    "state": "${data.stateMaster[\"Maharashtra\"].name}"
  },
  "steps": [
    {
      "given": {
        "op": "api.request",
        "with": {
          "method": "POST",
          "url": "${env:API_BASE_URL}/api/example",
          "json": {
            "stateName": "${params.state}",
            "city": "${data.cityMaster[\"New Delhi\"].name}",
            "cityRecord": "${data.cityMaster[\"New Delhi\"]._rec}"
          }
        }
      }
    }
  ]
}
```

## Add A New Step (SOP)
1. Create a new `*.step.ts` in the right domain folder.
2. Implement a `registerXSteps(registry)` function and `registry.register("op.name", handler)`.
3. Validate required `step.with` fields and throw clear errors.
4. Use adapters via `ctx.api` / `ctx.ui` and update `ctx.last` when helpful.
5. Export and register it from the domain `index.ts`.

## Custom Specs (test.spec)
Purpose: escape hatch for fully custom test logic.

Step shape example:
```json
{
  "when": {
    "op": "test.spec",
    "spec": "example.customHealth",
    "with": { "input": { "url": "${env:API_BASE_URL}/health" } },
    "saveAs": "custom.health"
  }
}
```

Register specs in the consuming project:
```ts
import { runFromMetadata } from "./runner/run-from-metadata";

await runFromMetadata({
  // ...
  specs: (specRegistry) => {
    specRegistry.register("example.customHealth", () => new CustomHealthSpec());
  },
});
```

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
