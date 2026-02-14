# Testing Module

## Folder Structure
- `contracts/`: metadata + runtime context types
- `core/`: engine, registry, interpolation, utilities
- `adapters/`: API (axios) and UI (Playwright) adapters
- `steps/`: step implementations grouped by domain
- `reporter/`: reporting interfaces + console reporter
- `runner/`: lifecycle helpers + metadata runner

## Metadata Shape
`TestingMetadata` lives under `testing` in module metadata JSON files.

```json
{
  "testing": {
    "specs": ["path/to/register-test-specs.js"],
    "data": [
      {
        "modelUserKey": "stateMaster",
        "recUserKeyValue": "Maharashtra",
        "data": {
          "name": "Maharashtra",
          "description": "State of Maharashtra"
        }
      }
    ],
    "scenarios": [
      {
        "id": "api-authenticate-success",
        "name": "Authenticate succeeds",
        "type": "api",
        "params": {
          "username": "alice"
        },
        "tags": ["smoke"],
        "timeoutMs": 30000,
        "retries": 1,
        "steps": [
          { "given": { "op": "api.request", "with": { "method": "POST", "url": "..." } } }
        ]
      }
    ]
  }
}
```

## Step Shape
Steps can be written as Given/When/Then blocks or as flat ops.

```ts
{
  id: "login-happy-path",
  type: "ui",
  steps: [
    { given: { op: "ui.goto", with: { url: "/login" } } },
    { when: { op: "ui.fill", with: { selector: "#user", value: "alice" } } },
    { and: { op: "ui.fill", with: { selector: "#pass", value: "secret" } } },
    { then: { op: "ui.click", with: { selector: "button[type=submit]" } } }
  ]
}
```

General step fields:
- `op` (required): operation name
- `with` (optional): op-specific options
- `saveAs` (optional): store the return value in the resource store (read via `${res:...}`)
- `name` (optional): label for reporting
- `timeoutMs` (optional): per-step timeout override
- `spec` (optional): used by `test.spec` to identify the spec

## Interpolation
Available tokens:
- `${env:NAME}` (environment variables)
- `${params.foo}` (scenario params)
- `${res:saveAs.path}` (saved step results)
- `${data:modelUserKey["recUserKeyValue"].field}` (test data from `testing.data`)
- `${data:modelUserKey["recUserKeyValue"]._rec}` (raw record object when used alone)

Test data lookup details:
- Data is indexed as `data:<modelUserKey>["<recUserKeyValue>"]`.
- You can access fields with `.fieldName`.
- Bracket syntax is recommended for keys with spaces or punctuation.
- Use `._rec` to return the full object when the token is the entire value.
- `data.` is still supported for backward compatibility, but `data:` is preferred.

Examples:
```json
{
  "params": {
    "state": "${data:stateMaster["Maharashtra"].name}"
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
            "city": "${data:cityMaster["New Delhi"].name}",
            "cityRecord": "${data:cityMaster["New Delhi"]._rec}"
          }
        }
      }
    }
  ]
}
```

## Ops Reference

### **Op: `api.request`**
Description: Executes an HTTP request using the API adapter.

Options in `with`:
- `method` (required)
- `url` (required)
- `headers` (optional)
- `json` (optional)
- `bodyText` (optional)
- `query` (optional, object or querystring)
- `formData` (optional, array of items)
- `body` (optional alias for `formData`)

Returns:
- `status`
- `headers`
- `bodyText`
- `bodyJson` (when JSON is detected)
- `body` (alias for `bodyJson ?? bodyText`)

Notes:
- Sets `ctx.last.apiResponse` for `assert.httpStatus`.

### **Op: `api.auth.bearerFromLogin`**
Description: Logs in and returns a bearer access token from the response.

Options in `with`:
- `url` (required)
- `username` (required)
- `password` (required)

Returns:
- access token string

### **Op: `ui.goto`**
Description: Navigates the browser to a URL.

Options in `with`:
- `url` (required)

### **Op: `ui.expectUrl`**
Description: Asserts the current page URL.

Options in `with`:
- `equals` (optional)
- `contains` (optional)

### **Op: `ui.fill`**
Description: Fills an input or editable element.

Options in `with`:
- `selector` (required)
- `value` (required)

### **Op: `ui.select`**
Description: Selects an option in a select element.

Options in `with`:
- `selector` (required)
- `value` (required)

### **Op: `ui.click`**
Description: Clicks an element located by selector.

Options in `with`:
- `selector` (required)

### **Op: `ui.press`**
Description: Presses a keyboard key on a focused element.

Options in `with`:
- `selector` (required)
- `key` (required)

### **Op: `ui.expectVisible`**
Description: Waits for an element to be visible.

Options in `with`:
- `selector` (required)

### **Op: `ui.expectText`**
Description: Asserts the text content of an element.

Options in `with`:
- `selector` (required)
- `equals` (optional)
- `contains` (optional)

### **Op: `assert.equals`**
Description: Asserts strict equality between two values.

Options in `with`:
- `actual` (required)
- `expected` (required)

### **Op: `assert.contains`**
Description: Asserts a string contains a substring.

Options in `with`:
- `actual` (required)
- `expected` (required)

### **Op: `assert.matches`**
Description: Asserts a string matches a regex pattern.

Options in `with`:
- `actual` (required)
- `pattern` (required)

### **Op: `assert.httpStatus`**
Description: Asserts the HTTP status of the last API response (or a provided response).

Options in `with`:
- `is` (required)
- `from` (optional, defaults to `ctx.last.apiResponse`)

### **Op: `assert.jsonPath`**
Description: Asserts a JSONPath-resolved value equals an expected value.

Options in `with`:
- `from` (required)
- `path` (required)
- `equals` (required)

### **Op: `util.log`**
Description: Logs a message (and optional data) to the console.

Options in `with`:
- `message` (required)
- `data` (optional)

### **Op: `util.sleep`**
Description: Pauses execution for a fixed duration.

Options in `with`:
- `ms` (required)

### **Op: `util.require`**
Description: Fails the step if a required resource is missing.

Options in `with`:
- `resource` (required)
- `message` (optional)

### **Op: `test.spec`**
Description: Runs a custom test spec registered via testing.specs.

Options in `with`:
- `input` (optional, free-form object passed to the spec)
- `specId` (optional alternative to `step.spec`)

Step fields:
- `spec` (required unless `with.specId` is provided)

Returns:
- `SolidTestSpecResult` (saved if `saveAs` is provided)

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
  }
});
```

When using `solidctl test run`, specs are loaded from `testing.specs` in module metadata.
Use `--print-api-logs` to print full API request/response details for `api.request` steps.

## Run From Metadata
```ts
import { runFromMetadata } from "./runner/run-from-metadata";
import metadata from "./testing-metadata.json";

await runFromMetadata({
  metadata,
  includeTags: ["smoke"],
  defaults: { timeoutMs: 30_000, retries: 1 },
  api: { baseUrl: "https://api.example.com" },
  ui: { baseUrl: "https://app.example.com", headless: true }
});
```

## Add A New Step (SOP)
1. Create a new `*.step.ts` in the right domain folder.
2. Implement a `registerXSteps(registry)` function and `registry.register("op.name", handler)`.
3. Validate required `step.with` fields and throw clear errors.
4. Use adapters via `ctx.api` / `ctx.ui` and update `ctx.last` when helpful.
5. Export and register it from the domain `index.ts`.
