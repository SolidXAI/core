# Testing Module

## Folder Structure
- `contracts/`: metadata + runtime context types
- `core/`: engine, registry, interpolation, utilities
- `adapters/`: API (axios), UI (Playwright) and mobile (Appium) adapters
- `steps/`: step implementations grouped by domain
- `reporter/`: reporting interfaces + console reporter
- `runner/`: lifecycle helpers + metadata runner

## Browser Setup
UI scenarios need a Chromium build. The npm `playwright` package ships no install script, so
the binary is fetched separately.

- **By default it is lazy.** The first test run that selects a UI scenario downloads Chromium
  (~150MB) before the run starts, then reuses it. Runs filtered to API-only scenarios never
  download anything, and neither do projects that have no UI scenarios.
- **To fetch it at install time instead**, set `COMMON_UI_TEST_BROWSERS_EAGER_INSTALL=true`
  either in the API project's `.env` or as a real environment variable. Useful for CI images.
  A failed download never fails the install. Note that `npm install --ignore-scripts` skips
  this entirely, in which case the lazy path still applies.
- **In Docker**, browsers land in `~/.cache/ms-playwright` (Linux). A multi-stage build that
  installs as `root` but runs as another user must set `PLAYWRIGHT_BROWSERS_PATH` to a shared
  location, or the runtime user will not find the binary.

## Mobile Setup
Mobile scenarios (`"type": "mobile"`, ops `mobile.*`) drive an Android emulator or phone through an
[Appium](https://appium.io) server. They are optional: nothing here is needed unless you run one.

- **Appium 3** with the **UiAutomator2** driver (`appium driver install uiautomator2`), started on the
  machine the device is attached to (`appium --port 4723`).
- **Android SDK** with `platform-tools`, `emulator` and **`build-tools`**. Appium needs the build-tools'
  `aapt2` to install an uploaded APK; its own doctor does not report this. Restart Appium after
  installing SDK packages, because it caches where the tools are.
- **`webdriverio`** installed in the app that runs the tests (`npm i webdriverio@^10.0.1`). It is an
  optional peer dependency of this package, loaded only when a mobile scenario starts. Its current
  release declares Node 22.19 or newer.
- **A device.** Every run names its device (`udid` from `adb devices`). Core never lets Appium pick one,
  and does not boot emulators: the caller (Test Hub) does that and passes the device serial.

A run needs `RunnerOptions.mobile`, or the `mobile` block of `POST /test-runs`:

```json
{
  "mobile": {
    "appiumUrl": "http://localhost:4723",
    "udid": "emulator-5554",
    "appSource": "installed",
    "appPackage": "com.acme.app",
    "appActivity": ".MainActivity"
  }
}
```

- `appSource: "upload"` installs the APK at `appPath` (an absolute path on the Appium machine) and clears
  the app's data at session start. `"installed"` opens an app that is already on the device and keeps its
  data, restarting it so each session starts on its home screen.
- Timeouts follow the UI adapter: `defaultTimeoutMs` (element waits, default 30 s) and
  `navigationTimeoutMs` (app launch). A step's own `timeoutMs` overrides both.
- All mobile scenarios in a run share one device session, in file order.
- The whole run is recorded, but the video (`run.mp4`) is only kept when the run fails. Android records 180 s per
  file, so a long run is recorded in chunks. Install `ffmpeg` on the Appium machine to get them merged; without it
  you get the most recent chunk (up to 3 minutes), which is the part leading up to the failure. A failed scenario
  also gets the device log (`console.json`). A screenshot (`screenshot.png`) is only attached when the run's
  `capture.screenshotOnFailure` is on, because it is a binary upload. The device log is filtered
  to what is useful: warnings and errors from anything, the app's own lines, and the React Native, crash and
  WebView tags. Each entry's `type` is read from the Android priority in the log line; the newest 500 are kept.

**Start every mobile scenario with `mobile.launch` and `"clearData": true`.** An app remembers things
between scenarios (who is logged in, the cart), so one scenario can break the next. Leave `clearData` out
only when a scenario deliberately relies on state prepared outside the test.

## Metadata Shape
`TestingMetadata` lives under `testing` in module metadata JSON files.

```json
{
  "testing": {
    "specs": ["path/to/register-test-specs.js"],
    "roles": [
      { "name": "Editor", "permissions": ["BookController.*"] }
    ],
    "users": [
      { "username": "testEditor", "email": "testEditor@test.local", "password": "Test@1234", "roles": ["Editor"] }
    ],
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

## Timeouts
There are two independent timeout layers. They are easy to confuse, so note which one you want:

**1. Engine timeouts** — `scenario.timeoutMs` and the top-level `step.timeoutMs`.
These wrap execution in a `Promise.race` (`core/timeout.ts`). They are a hard upper bound
on wall-clock time and do **not** cancel the underlying browser call, so the failure message
only tells you the scenario or op that overran.

**2. UI (Playwright) timeouts** — the run-wide default plus per-step `with.timeoutMs`.
This is what governs how long `ui.expectVisible`, `ui.click`, `ui.fill` etc. wait for a
selector. Playwright cancels the operation itself, so the error names the selector and the
state it was waiting for. **If your UI steps are timing out, this is the knob to turn.**

Resolution order for UI steps: `with.timeoutMs` → `--ui-timeout-ms` → `UI_TIMEOUT_MS` →
`uiTestDefaultTimeoutMs` setting → `30000`.
`ui.goto` uses the navigation timeout instead: `with.timeoutMs` → `--ui-navigation-timeout-ms`
→ `UI_NAVIGATION_TIMEOUT_MS` → `uiTestNavigationTimeoutMs` setting → the resolved UI timeout.

Raise the default for a whole run:
```bash
solid test run --module <module-name> --ui-timeout-ms 60000
# or
UI_TIMEOUT_MS=60000 solid test run --module <module-name>
```

Or set the installation-wide default under **Settings → Testing Settings** in the admin UI
(`uiTestDefaultTimeoutMs` / `uiTestNavigationTimeoutMs`). Those rows are created by `solid seed`;
until then the built-in `30000` applies. Flags and env vars still win, so CI keeps per-run control.

The seeded value of those two settings can be provisioned from the environment with
`COMMON_UI_TEST_DEFAULT_TIMEOUT_MS` and `COMMON_UI_TEST_NAVIGATION_TIMEOUT_MS` (the latter falls
back to the former). Seeding is insert-only, so these apply on first seed only — afterwards the
stored value wins and the setting must be changed in the admin UI. Values that are missing,
non-numeric, or not positive fall back to `30000`.

Note these are distinct from the run-time `UI_TIMEOUT_MS` / `UI_NAVIGATION_TIMEOUT_MS` vars,
which override the setting on a per-run basis and are read every run.

Or bump only the one slow step, leaving the rest of the suite strict:
```json
{
  "then": {
    "op": "ui.expectVisible",
    "with": { "selector": "#report-grid", "timeoutMs": 90000 }
  }
}
```

Caution: a scenario-level `timeoutMs` lower than the UI timeout will fire first and mask the
more useful Playwright error. Keep `defaults.timeoutMs` above your UI timeout.

## Interpolation
Available tokens:
- `${env:NAME}` (environment variables)
- `${params.foo}` (scenario params)
- `${res:saveAs.path}` (saved step results)
- `${random:<generator>}` or `${random:<generator>(name=value, ...)}` (random test data; see below)
- `${now:<kind>}` or `${now:<kind>(offset=+7d, format=DD/MM/YYYY)}` (the current date or time; see below)
- `${data:modelUserKey["recUserKeyValue"].field}` (test data from `testing.data`)
- `${data:modelUserKey["recUserKeyValue"]._rec}` (raw record object when used alone)

`util.script` is the exception: it resolves its own `input`, where a value that is exactly one token keeps its
type (a list stays a list), and its `script` is never interpolated. See *Op: `util.script`*.

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

### Reading saved results
`${res:<name>.<path>}` reads what an earlier step saved with `saveAs`. An `api.request` result has `status`,
`headers`, `bodyText` and `bodyJson`. The examples read a `books` result whose body is:

```json
{ "records": [ { "id": 7, "title": "Dune" }, { "id": 8, "title": "Emma", "note": "" } ] }
```

Paths:
- `${res:books.status}` gives `200`.
- `${res:books.bodyJson.records.0.id}` gives `7`. A number in the path is a position in a list, counted from 0.
- `${res:books.bodyJson.records[1].title}` gives `Emma`. Brackets and dots mean the same.
- `${res:books.bodyJson.records.length}` gives `2`, the number of records.
- `${res:books.bodyJson.records.0}` gives the whole first record, as JSON text.
- `${res:created.headers.location}` reads a response header. Header names are lower case.

A token becomes text, even when it is the whole value (except a `._rec` record, a secret that is not text, and
`util.script`'s `input`). So in `assert.equals` write the expected value as text: `"expected": "7"`, not `7`.

Transforms go after the path, each after a `|`:
- `| match:PATTERN` runs a regular expression over the value and gives the part in brackets, or the whole match
  when the pattern has no brackets.
- `| default:VALUE` replaces a value that is null or empty.

```json
{ "then": { "op": "assert.equals", "with": { "actual": "${res:created.headers.location | match:/api/book/(\\d+)}", "expected": "42" } } },
{ "and":  { "op": "api.request", "with": { "method": "GET", "url": "${env:API_BASE_URL}/api/order/${res:receipt.bodyText | match:ref=([A-Z0-9-]+)}" } } },
{ "and":  { "op": "ui.fill", "with": { "selector": "#note", "value": "${res:books.bodyJson.records.1.note | default:none}" } } }
```

The first gives `42` from a `Location: /api/book/42` header. The second takes `BK-2026-0042` from a plain-text
body such as `Created book id=42 ref=BK-2026-0042`. The third types `none`, because that record's note is empty.

Each of these fails the step:
- A path that does not exist (`Missing resource for token`). `default:` does not help here: it replaces only a
  null or empty value.
- A pattern that matches nothing.
- A pattern that contains `}` or `|`: the `}` ends the token, and `|` starts another transform. Write `\d\d`
  rather than `\d{2}`. For alternatives such as `(id|ref)`, use `util.script`.

In a JSON file, double every backslash: `\\d` in the file reaches the pattern as `\d`. On a list or object,
`match:` runs over its JSON text. For the last item of a list, an item found by a field value, or anything
computed, use `util.script`.

### Random test data
Every generator, argument and value is listed on the docs page *Random Test Data* (`developer-docs/testing/random-test-data`); the table below is the short form.
`${random:...}` generates realistic values that are never repeated within one run, so a run can
create several records whose fields must be unique (emails, phone numbers, PANs, invoice numbers).
Each run starts afresh. Every generator takes `unique=false` to allow repeats.

| Generator | Arguments (default first) | Example |
|---|---|---|
| `firstName` | `locale`: `any`, `in`, `gb`, `us` | `Priya` |
| `lastName` | `locale`: `any`, `in`, `gb`, `us` | `Sharma` |
| `emailAddress` | `domain`: `example.com`; `format`: `first.last`, `firstlast`, `first_last`, `flast`, `random`; `digits` (after the name): `4`, 0–8; `length` (for `random`): `10`, 4–64 | `priya.sharma4821@example.com` |
| `mobileNo` | `country`: `in`, `gb`, `us`; `format`: `digits`, `national`, `e164`, `international`; `fictional`: `false` (UK and US only) | India `9876543210`, `+91 98765 43210`; UK `07912 345678`, `+447912345678`; US `(415) 234-5678`, `+1 415-234-5678` |
| `panNo` | `holderType`: `P`, `C`, `H`, `F`, `A`, `T`, `B`, `L`, `J`, `G` | `ABCPK1234Z` |
| `date` | `from`: `-1y` and `to`: `+1y` (`today`, `now`, `2026-10-17`, or shifts such as `-18y`, `+30d`, `+1d+2h`); `time`: `none`, `random`, or a window `09:00-18:00`; `format`: a dayjs pattern, `iso` or `epoch` (default `YYYY-MM-DD`); `tz`: `local`, `utc` or `Asia/Kolkata`; `unique`: **`false`** | `1987-04-12`, `03/11/2026` |
| `invoiceId` | `prefix`: `INV` (empty for none); `separator`: `-`, `/`, `_`, `none`; `length` (digits): `8`, 4–20; `date`: `none`, `yyyy`, `yyyymm`, `yyyymmdd`, `yyyymmddhhmm`, `yyyymmddhhmmss` | `INV-00482913`, `INV-20261017143205-00482913` |

- **Arguments** are `name=value` pairs: `${random:emailAddress(domain=acme.test, digits=0)}`. A simple
  value (letters, digits and `. - / _ + : @`) is written bare. Anything else, such as a space, comma or
  bracket, goes in quotes: `${now:date(format='D MMM, YYYY')}`. Prefer single quotes, since double quotes
  must be escaped inside JSON; a backslash writes the quote character itself (`'it\'s'`).
- **Each token gives a new value.** To type a value in one step and assert it in another, generate
  it once with `util.random` and read it back with `${res:...}`:

  ```json
  { "given": { "op": "util.random", "with": { "generator": "emailAddress", "args": { "domain": "acme.test" } }, "saveAs": "newEmail" } },
  { "when":  { "op": "ui.fill", "with": { "selector": "#email", "value": "${res:newEmail}" } } },
  { "then":  { "op": "ui.expectText", "with": { "selector": ".profile-email", "equals": "${res:newEmail}" } } }
  ```

- **Phone numbers are real-looking, so they may belong to someone.** Run against a test SMS
  provider, or pass `fictional=true` with `country=gb` (Ofcom's drama range, 07700 900000–900999) or
  `country=us` (555-0100 to 555-0199 in each area code). India has no such range, so `country=in`
  with `fictional=true` is an error. A phone number counts as
  used whatever its format, so the same number cannot come back as `e164` after `digits`.
- **Names come from fixed lists** (50 first and 50 last names per locale; 150 first and 123 last names for `any`). A run that asks for more
  distinct names than the list holds fails with a message saying so; pass `unique=false` then.
- **Emails** use `example.com` by default, which never receives mail. The digits after the name
  keep addresses distinct across runs as well, where an application's unique-email rule would
  otherwise reject one seen in an earlier run.
- **PANs** have the right shape (3 letters, holder type, a letter, 4 digits, a letter). The last
  letter is a check letter whose rule is not published, so it is random: fine for format checks,
  not for a service that verifies the PAN.

### Current date and time
`${now:<kind>(offset=…, format=…, tz=…)}` gives the current moment, shifted by `offset`. It is not random:
the same instant gives the same value.

| Kind | Default format | Example |
|---|---|---|
| `date` | `YYYY-MM-DD` | `2026-10-17` |
| `time` | `HH:mm:ss` | `14:46:15` |
| `datetime` | `YYYY-MM-DD HH:mm:ss` | `2026-10-17 14:46:15` |

ISO 8601 and epoch milliseconds are formats, not kinds: `${now:datetime(format=iso)}` gives `2026-10-17T14:46:15+05:30` (`…Z` with `tz=utc`), and `${now:datetime(format=epoch)}` gives `1792228575000`.

- `offset` is `0` or terms such as `+7d`, `-1m`, `+1d+2h`: `y` years, `m` months, `w` weeks, `d` days,
  `h` hours, `min` minutes, `s` seconds. A month shift stops at the end of a shorter month (31 Jan + 1m is 28 Feb).
- `format` is a [dayjs](https://day.js.org/docs/en/display/format) pattern: `YYYY` year, `MM` month,
  `DD` day, `HH` hour, `mm` minutes, `MMM` month name. Text in `[brackets]` is literal. Java and C# patterns
  (`dd/mm/yyyy`) are refused with the token to use instead.
- `tz` is `local` (the machine running the test), `utc`, or a zone such as `Asia/Kolkata`. A date near
  midnight can differ between zones, so set `tz` when the app compares dates in one.
- Two `${now:...}` tokens can differ by a second. To type a timestamp and then assert it, take it once with
  `util.now` and `saveAs`.
- `random:date` takes the same `format`, `tz` and shifts. It allows repeats by default (a year has
  only 365 days); pass `unique=true` when a date must be distinct.

Date recipes:

| Need | Token |
|---|---|
| Date of birth, aged 18 to 60 | `${random:date(from=-60y, to=-18y)}` |
| The same, written 12/04/1987 | `${random:date(from=-60y, to=-18y, format=DD/MM/YYYY)}` |
| A date in the past year | `${random:date(from=-1y, to=today)}` |
| A due date in the next 30 days | `${random:date(from=today, to=+30d)}` |
| A date in a fixed period | `${random:date(from=2026-04-01, to=2027-03-31)}` |
| A slot in business hours, next two weeks | `${random:date(from=today, to=+14d, time=09:00-18:00)}` |
| A time in the next two hours | `${random:date(from=now, to=now+2h, time=random)}` |
| Today | `${now:date}` |
| A week from today | `${now:date(offset=+7d)}` |
| Yesterday (an expired date) | `${now:date(offset=-1d)}` |
| Exactly 18 years ago today (an age-limit boundary) | `${now:date(offset=-18y)}` |
| The current moment as an ISO timestamp, in UTC | `${now:datetime(tz=utc, format=iso)}` |

In `from`, `to` and `offset`, `now` and shifts in `h`, `min` or `s` mean an exact moment. Anything else (`today`, a fixed date, shifts in `y`, `m`, `w` or `d`) means the whole day, so `to=today` includes all of today. A shift with no base counts from the start of today, so a time ahead of the current moment is written with the base: `to=now+2h`, not `to=+2h`.

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
- `formData` (optional, array or object)
- `body` (optional alias for `formData`)

Returns:
- `status`
- `headers`
- `bodyText`
- `bodyJson` (when JSON is detected)
- `body` (alias for `bodyJson ?? bodyText`)

Notes:
- Sets `ctx.last.apiResponse` for `assert.httpStatus`.
- `formData` can be an array of items or a plain object.
- If `formData` is an object, keys become field names and values become field values.
- File values can be `file:/absolute/path` or `url:https://...` and will be uploaded as files.
- Non-string object values are JSON-stringified before sending.

Form data item notes:
- Array form items: `{ name, value, type?: "text" | "file", filename?, contentType? }`.
- File values can be `file:/absolute/path` or `url:https://...`.
- If `formData` is an object, keys become field names and values become field values.
- Use `formData`/`body` instead of `json` or `bodyText`.

Example (array form):
```json
{
  "when": {
    "op": "api.request",
    "with": {
      "method": "POST",
      "url": "${env:API_BASE_URL}/api/lead",
      "formData": [
        { "name": "venueUserKey", "value": "Kolhapur-Karvir" },
        { "name": "coupon", "type": "file", "value": "file:/abs/path/image.jpg" },
        { "name": "campaignUserKey", "value": "Campaign: Drawing Competition" }
      ]
    }
  }
}
```

Example (object form from `testing.data`):
```json
{
  "when": {
    "op": "api.request",
    "with": {
      "method": "POST",
      "url": "${env:API_BASE_URL}/api/lead",
      "formData": "${data:lead[\"LeadWithFile\"]._rec}"
    }
  }
}
```

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
- `timeoutMs` (optional, overrides the run-wide UI navigation timeout)

### **Op: `ui.expectUrl`**
Description: Waits for the page URL to match, then asserts it. Backed by `page.waitForURL`, so an
assertion placed straight after a navigating click does not race the navigation. Returns
immediately when the URL already matches.

Options in `with`:
- `equals` (optional)
- `contains` (optional)
- `timeoutMs` (optional, overrides the run-wide UI navigation timeout)

### **Op: `ui.fill`**
Description: Fills an input or editable element.

Options in `with`:
- `selector` (required)
- `value` (required)
- `timeoutMs` (optional, overrides the run-wide UI timeout)

### **Op: `ui.select`**
Description: Selects an option in a select element.

Options in `with`:
- `selector` (required)
- `value` (required)
- `timeoutMs` (optional, overrides the run-wide UI timeout)

### **Op: `ui.click`**
Description: Clicks an element located by selector.

Options in `with`:
- `selector` (required)
- `timeoutMs` (optional, overrides the run-wide UI timeout)

### **Op: `ui.press`**
Description: Presses a keyboard key on a focused element.

Options in `with`:
- `selector` (required)
- `key` (required)
- `timeoutMs` (optional, overrides the run-wide UI timeout)

### **Op: `ui.uploadFile`**
Description: Sets one or more files on a file input.

Options in `with`:
- `selector` (required, the `<input type="file">`)
- `filePath` (required, a path or an array of paths)
- `timeoutMs` (optional, overrides the run-wide UI timeout)

Notes:
- Paths are resolved against the run's working directory, so a relative path is relative to where
  `solid test run` was invoked.
- Pass an array to populate a `multiple` input; a single string is the common case.

### **Op: `ui.waitForManual`**
Description: Pauses a headed Playwright run so a human can interact with the live browser, then resumes when Enter is pressed in the terminal.

Options in `with`:
- `message` (optional, defaults to a generic instruction)
- `prompt` (optional, defaults to `Press Enter to continue...`)
- `waitForSelector` (optional, waits for a visible selector after resume)
- `waitForUrlEquals` (optional, waits until the current URL exactly matches)
- `waitForUrlContains` (optional, waits until the current URL contains a substring)
- `timeoutMs` (optional, timeout for post-resume waits; defaults to the run-wide UI timeout)
- `bringToFront` (optional, defaults to `true`)

Notes:
- Requires `--headless false`.
- Requires an interactive terminal (TTY).
- Useful for OTP screens or third-party verification challenges that must be completed by a human.

Example:
```json
{
  "then": {
    "op": "ui.waitForManual",
    "with": {
      "message": "Enter the OTP in the browser, then return here to continue.",
      "waitForSelector": "text=Dashboard",
      "timeoutMs": 30000
    }
  }
}
```

### **Op: `ui.expectVisible`**
Description: Waits for an element to be visible.

Options in `with`:
- `selector` (required)
- `timeoutMs` (optional, overrides the run-wide UI timeout)

### **Op: `ui.expectHidden`**
Description: Waits for an element to be hidden — i.e. detached or no longer visible.

Options in `with`:
- `selector` (required)
- `timeoutMs` (optional, overrides the run-wide UI timeout)

Notes:
- The counterpart to `ui.expectVisible`: use it to wait for a modal, spinner, toast or overlay to
  **go away** before the next step acts. Prefer it over `util.sleep` for that — it returns the moment
  the element disappears instead of always spending the full duration.

### **Op: `ui.expectText`**
Description: Asserts the text content of an element.

Options in `with`:
- `selector` (required)
- `equals` (optional)
- `contains` (optional)
- `timeoutMs` (optional, overrides the run-wide UI timeout)

### **Mobile ops (`mobile.*`)**
Every op that takes a `locator` waits for the element to be displayed first. `with.timeoutMs` (or the
step's `timeoutMs`) overrides the wait. `locator` is an object:

```json
{ "by": "accessibilityId", "value": "Login button" }
```

| `by` | Finds | Notes |
|---|---|---|
| `accessibilityId` | Android `content-desc`; React Native `accessibilityLabel` / `testID` | Preferred when unique |
| `id` | Resource id | A bare id gets the app package prefixed (`edit` becomes `<package>:id/edit`). React Native apps have none. |
| `text` / `textContains` | Visible text | Exact / partial |
| `description` | `content-desc` through UiSelector | |
| `uiautomator` | A raw `new UiSelector()...` expression | Escape hatch |
| `xpath` | An XPath | Last resort; slower and fragile |

Add `"index": 1` (0-based) to pick one match. A locator that matches more than one element **fails the
step** unless it has an `index`. An `"android": { "by": ..., "value": ... }` block replaces `by`/`value`
on Android, and `"ios"` does the same on iOS.

A step waits by looking for the element about every half second and goes on as soon as it is there, so
`timeoutMs` is the longest it will wait, not how long it waits. Each lookup is also held to the step's
timeout: if the device does not answer a lookup in time (a busy phone can leave one unanswered for tens of
seconds), the step fails with "The device did not answer while looking for ..." rather than running past
its timeout. On Android the runner sets `appium:settings[waitForIdleTimeout]` to 500 ms; give a device a
different value with `extraCapabilities` (Test Hub's "Default Appium capabilities" setting does this for
every run).

| Op | `with` | Does |
|---|---|---|
| `mobile.launch` | `clearData` (optional, default false), `grantPermissions` (optional, default true) | Stops the app, optionally wipes its data, starts it. Android clears an installed app in place. iOS has no "clear data": it removes the app and installs the uploaded build again (the Simulator's `.app`, an iPhone's `.ipa`), so `clearData` fails on an iOS device that has no build (see "The reset scenario") |
| `mobile.reset` | – | `mobile.launch` with `clearData: true` |
| `mobile.terminate` | – | Stops the app |
| `mobile.tap` | `locator`, `optional` (optional) | Taps the element |
| `mobile.type` | `locator`, `text`, `clear` (default true), `optional` (optional) | Sets the text; `clear: false` appends |
| `mobile.clear` | `locator` | Clears the field |
| `mobile.swipe` | `direction` (up/down/left/right), `percent` (0.1 to 1, default 0.75), `locator` (optional) | Swipes on the element, or the screen |
| `mobile.scrollTo` | `locator`, `direction` (down/up, default down), `maxSwipes` (default 10) | Swipes until the element shows |
| `mobile.back` | `optional` (optional) | Presses Back |
| `mobile.hideKeyboard` | `method` (iPhone only, recorded by authoring: `driver`, `doneKey`, `tapOutside`, `swipeDown`) | Hides the keyboard if it is shown. On a real iPhone iOS has no hide action, so the keyboard's own Done key, a tap on a spot that is on no control, and a swipe down are tried in turn; the step passes with the first that works and fails when none does. The recorded `method` is tried first on a run |
| `mobile.submit` | `action` (optional: `search`, `go`, `send`, `done`, `next`, `enter`) | Presses the keyboard's action key on the field that has focus, e.g. to run a search. Typing `\n` does not submit, because the field takes it as a character. Android performs the editor action (`done` when none is named; `enter` presses the Enter key); iOS taps the keyboard's own key. No locator, never heals |
| `mobile.expectVisible` | `locator` | Passes when the element is displayed in time |
| `mobile.expectHidden` | `locator` | Passes when no match is displayed in time |
| `mobile.expectText` | `locator` and exactly one of `equals`, `contains`, `matches` (a regex) | Compares the element's text; returns it |
| `mobile.getText` | `locator` | Returns the element's text (use `saveAs`) |

`api.*`, `assert.*`, `util.*` and `test.spec` ops can be mixed in, for example to check the backend after a
tap. `ui.*` ops cannot be used in a mobile scenario.

#### Optional steps
`mobile.tap`, `mobile.type` and `mobile.back` accept `"optional": true`. The step looks for its element for
`timeoutMs` (default 3 seconds) and, if it is not there, passes without doing anything. That time is how long it
keeps re-checking, so a screen that is still drawing can settle; each individual check may take as long as an ordinary
step's wait (`defaultTimeoutMs`, 30 s) to answer, so a slow phone's late "not there" still skips the step. An optional
step only passes over a missing element: any other failure still fails it, and it never heals. It is meant for a reset,
which has to work from any state (a "Log out" button only exists when someone is logged in).

#### Healing: `fallbacks` and `fingerprint`
A step with a `locator` can carry other ways to find the same element, written when the scenario was authored:

```json
{ "op": "mobile.tap", "with": {
    "locator": { "by": "accessibilityId", "value": "Save" },
    "fallbacks": [{ "by": "text", "value": "Save" }],
    "fingerprint": { "kind": "Button", "accessibilityId": "save-button", "label": "Save" }
} }
```

If the locator matches nothing within 2.5 seconds, the runner tries each fallback, then the fingerprint
(`accessibilityId`, `resourceId`, `text`, `label`, in that order). The first one that matches **exactly one
displayed element** is used, the step carries on, and the heal is reported on `scenario.end` with the locator
it replaced (`from`), the one that worked (`to`), and which locator that was in `field`: `locator`, or
`locator.android` / `locator.ios` when the run used that platform's override. The run's `healing` setting
controls it: `off` uses the locator only, `report` (the default) heals and reports, `auto` is `report` plus
permission to write the heal back to the scenario file.

`tap`, `type`, `clear`, `getText`, `expectVisible`, `expectText` and `swipe` on an element heal.
`expectHidden` does not (swapping a locator that should match nothing would hide a regression), and neither
does `scrollTo`.

#### Sessions and the reset scenario
A mobile run shares one device session, so by default each scenario carries on in the app as the last one left
it. The scenario fields `dependsOn`, `saveSession` and `session` work for mobile too; what they mean here is
about the app, not a browser:

- `"session": "shared"` (default): carry on in the app as it is.
- `"session": "fresh"`: start from scratch. On a device that can clear an app's data, the runner launches the
  app with its data cleared. On an iOS device with no build to reinstall it relaunches the app and runs the file's
  reset scenario.
- `"session": "restore"`: start logged in as the scenario it depends on left the app. If that scenario
  (`saveSession: true`) has just passed and nothing has touched the app since, the app is only relaunched.
  Otherwise, when the app was last brought to that scenario's state, it is relaunched and the scenario's last
  `mobile.expectVisible` is looked for (up to 5 seconds): found, the scenario carries on and the login is not
  run again; not found (something logged out, or the app crashed), or when that scenario ends on no check, the
  app starts from scratch and that scenario's steps run again (and, for a scenario that was itself restored,
  the ones before it). End a login scenario on a check of the logged-in screen to let restores skip it.

These steps run as setup inside the scenario that needs them. They are reported with the step event's `setup`
field (`"reset"` or `"restore"`) and keep the id and `steps[n]` paths of the scenario they come from.

**The reset scenario.** An iOS device with no build to reinstall (an iPhone without an uploaded `.ipa`, or a Simulator
with only an installed app) cannot clear an app's data, so the file declares one scenario with `"reset": true`
that brings the app back to its signed-out start screen from any state. A scenario whose first step is
`mobile.launch` with `clearData` (or `mobile.reset`) then starts through it, and that first step only relaunches the
app. A run on such a device ends before it starts, naming the scenarios, when the file has no reset scenario, or when
a scenario clears the data partway through. With a build to reinstall none of this applies. It is never run
as a scenario of its own, selected, or counted; it cannot use `dependsOn`, `saveSession` or `session`, and no
scenario can depend on it. Use `optional` steps for what only applies in some states:

```json
{ "id": "reset-app", "type": "mobile", "reset": true, "steps": [
  { "given": { "op": "mobile.launch" } },
  { "and": { "op": "mobile.tap", "with": { "locator": { "by": "accessibilityId", "value": "open menu" }, "optional": true } } },
  { "and": { "op": "mobile.tap", "with": { "locator": { "by": "accessibilityId", "value": "menu item log out" }, "optional": true } } },
  { "then": { "op": "mobile.expectVisible", "with": { "locator": { "by": "accessibilityId", "value": "login screen" } } } }
] }
```

If a scenario asks for a fresh start on an iPhone and the file has no reset scenario, it fails and says what to
add. If a reset step fails, the scenario fails with `Setup "reset" (scenario "<id>") failed at <path>: ...`.

Example:
```json
{
  "id": "rn-login-happy-path",
  "type": "mobile",
  "steps": [
    { "given": { "op": "mobile.launch", "with": { "clearData": true } } },
    { "when": { "op": "mobile.tap", "with": { "locator": { "by": "accessibilityId", "value": "open menu" } } } },
    { "and": { "op": "mobile.tap", "with": { "locator": { "by": "accessibilityId", "value": "menu item log in" } } } },
    { "and": { "op": "mobile.type", "with": { "locator": { "by": "accessibilityId", "value": "Username input field" }, "text": "bob@example.com" } } },
    { "and": { "op": "mobile.type", "with": { "locator": { "by": "accessibilityId", "value": "Password input field" }, "text": "${secret:RN_DEMO_PASSWORD}" } } },
    { "and": { "op": "mobile.hideKeyboard" } },
    { "and": { "op": "mobile.tap", "with": { "locator": { "by": "accessibilityId", "value": "Login button" } } } },
    { "then": { "op": "mobile.expectVisible", "with": { "locator": { "by": "accessibilityId", "value": "products screen" } } } }
  ]
}
```

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

### **Op: `util.random`**
Description: Returns one random value (see *Random test data*), to keep with `saveAs`.

Options in `with`:
- `generator` (required): `firstName`, `lastName`, `emailAddress`, `mobileNo`, `panNo`, `date` or `invoiceId`
- `args` (optional): the generator's arguments as an object, e.g. `{ "format": "e164" }`

### **Op: `util.now`**
Description: Returns the current date or time (see *Current date and time*), to keep with `saveAs`.

Options in `with`:
- `kind` (optional): `date` (default), `time` or `datetime`. For ISO 8601 or epoch milliseconds, pass
  `"format": "iso"` or `"epoch"` in `args`
- `args` (optional): `offset`, `format` and `tz` as an object, e.g. `{ "offset": "+7d" }`

### **Op: `util.script`**
Description: Runs a short TypeScript function over `input` and returns its result, to keep with `saveAs`.
Use it for what a token cannot do: find an item by a condition, combine two responses, reshape a value
for the next request. A fixed path (`${res:r.bodyJson.records.0.id}`) or a regex (`| match:`) needs no script;
see *Reading saved results*.

Options in `with`:
- `script` (required): a function body, as text or a list of lines, that ends with `return`
- `input` (optional): an object of values the script reads as `input.<name>`
- `timeoutMs` (optional, on the step): stops a script that runs too long; defaults to `5000`, at most `30000`

Tokens go in `input`, code goes in `script`:
```json
{ "when": { "op": "api.request", "with": { "method": "GET", "url": "${env:API_BASE_URL}/api/book" }, "saveAs": "books" } },
{ "and":  { "op": "util.script", "with": {
    "input": { "records": "${res:books.bodyJson.records}", "title": "${params.title}" },
    "script": [
      "const book = input.records.find((b: any) => b.title === input.title);",
      "if (!book) throw new Error(`No book titled ${input.title}`);",
      "return book.id;"
    ] }, "saveAs": "bookId" } },
{ "then": { "op": "api.request", "with": { "method": "DELETE", "url": "${env:API_BASE_URL}/api/book/${res:bookId}" } } }
```

Notes:
- The script sees only `input` and `console`. Anything it needs from the run, such as saved results, params,
  test data, secrets, or random and current values, goes in `input` as a token, so each step shows what it depends on.
- A value in `input` that is exactly one token keeps its type: `"${res:books.bodyJson.records}"` arrives as a
  list and `"${res:r.status}"` as a number. A token inside text (`"id-${res:r.status}"`) is text, as in any op.
- Don't write tokens inside `script`; the step refuses them. Inside code, `${...}` belongs to JavaScript: in a
  template literal such as `` `Book ${input.id}` `` it inserts a variable's value. So the runner leaves the
  script exactly as written, and values reach it only through `input`.
- The script runs synchronously: no `await`, `require`, timers or network. It gets a copy of `input`, so it
  cannot change a saved result. While it runs, nothing else in the runner's process does (in test-hub, the
  whole API), which is why the timeout is capped at 30 seconds. Keep scripts small: there is no memory limit.
- It must return data (text, numbers, true/false, lists or objects). The result is saved as JSON, so a date
  comes back as ISO text. With `saveAs`, a script that returns nothing fails. Without `saveAs`, a throw still
  fails the step, so a script can act as a custom check.
- `console.log`, `info`, `warn`, `error` and `debug` are collected and attached to the step's report as
  *util.script console*, also when the script fails.
- TypeScript is compiled with the project's `typescript` package. Where that is not installed, write plain JavaScript.
- The script runs in a Node `vm` context that is given only text: `input` arrives as JSON, `console` is defined
  inside it, and the result leaves as JSON. That keeps the runner's own objects, and with them `process` and
  `require`, out of reach. Node does not promise that `vm` is a security boundary, though, so a script still
  runs with the trust of whoever can change the scenario file, and in test-hub that file is the application's
  tracked branch.
- For I/O, async work or logic shared between scenarios, write a `test.spec`.

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
Use `--skip-scenario-ids` to exclude scenarios by id (comma-separated).
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
  ui: {
    baseUrl: "https://app.example.com",
    headless: true,
    defaultTimeoutMs: 30_000,
    navigationTimeoutMs: 45_000
  }
});
```

## CLI Workflows
Full isolated-database workflow:
1. `npx @solidxai/solidctl@latest test data --setup`
2. `npx @solidxai/solidctl@latest seed`
3. `npx @solidxai/solidctl@latest test data --load`
4. `npx @solidxai/solidctl@latest test run --module <module-name>`
5. `npx @solidxai/solidctl@latest test data --teardown`

Lightweight existing-database workflow:
1. `npx @solidxai/solidctl@latest test data --load`
2. `npx @solidxai/solidctl@latest test run --module <module-name> --headless false`
3. `npx @solidxai/solidctl@latest test data --unlink`

`test data --unlink` deletes records declared in `testing.data` in reverse order using each model's actual `userKeyFieldUserKey` value from `testing.data[*].data`. This assumes `testing.data` is authored in dependency order, with parent records appearing before dependent records.

For human-assisted OTP or third-party verification flows, use `ui.waitForManual` in a headed run so the browser remains interactive while the scenario is paused.

Common `test run` flags (all pass through solidctl unchanged):
- `--ui-base-url <url>` / `--api-base-url <url>`
- `--headless [true|false]`
- `--ui-timeout-ms <number>` — default wait for every UI step (see [Timeouts](#timeouts))
- `--ui-navigation-timeout-ms <number>` — default wait for `ui.goto`
- `--timeout-ms <number>` / `--retries <number>` — scenario-level guard and retry count
- `--scenario-ids <ids>` / `--include-tags <tags>` / `--skip-scenario-ids <ids>`
- `--fail-fast [true|false]` — stop at the first failed scenario (the default). `--fail-fast false` runs every scenario, then still reports the run as failed and exits with code 1 if any failed
- `--no-progress` — disable the interactive test progress footer

## Add A New Step (SOP)
1. Create a new `*.step.ts` in the right domain folder.
2. Implement a `registerXSteps(registry)` function and `registry.register("op.name", handler)`.
3. Validate required `step.with` fields and throw clear errors.
4. Use adapters via `ctx.api` / `ctx.ui` and update `ctx.last` when helpful.
5. Export and register it from the domain `index.ts`.
