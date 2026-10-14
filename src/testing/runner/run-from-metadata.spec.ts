import * as http from "http";
import type { AddressInfo } from "net";

import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import type { Reporter, RunEndArgs, ScenarioResult, ScenarioSkipInfo } from "../reporter/reporter.types";
import { runFromMetadata } from "./run-from-metadata";

type Event =
  | { type: "end"; id: string; ok: boolean; error?: string }
  | { type: "skip"; id: string; dependency: string }
  | { type: "run"; args: RunEndArgs };

function recordingReporter(events: Event[]): Reporter {
  return {
    onScenarioStart() {},
    onScenarioEnd(scenario: ScenarioSpec, result: ScenarioResult) {
      events.push({ type: "end", id: scenario.id, ok: result.ok, error: result.error ? String(result.error) : undefined });
    },
    onScenarioSkipped(scenario: ScenarioSpec, info: ScenarioSkipInfo) {
      events.push({ type: "skip", id: scenario.id, dependency: info.dependency });
    },
    onStepStart() {},
    onStepEnd() {},
    onRunEnd(args: RunEndArgs) {
      events.push({ type: "run", args });
    },
  };
}

const pass = (id: string, extra: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id,
  type: "api",
  steps: [{ op: "assert.equals", with: { actual: 1, expected: 1 } }],
  ...extra,
});
const fail = (id: string, extra: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id,
  type: "api",
  steps: [{ op: "assert.equals", with: { actual: 1, expected: 2 } }],
  ...extra,
});

describe("runFromMetadata without dependencies", () => {
  it("still stops at the first failure", async () => {
    const events: Event[] = [];
    await expect(
      runFromMetadata({ scenarios: [pass("a"), fail("b"), pass("c")], reporter: recordingReporter(events) }),
    ).rejects.toThrow(/Expected values to be equal/);
    expect(events.filter((e) => e.type === "end").map((e) => (e as any).id)).toEqual(["a", "b"]);
    const run = events.find((e) => e.type === "run") as { args: RunEndArgs };
    expect(run.args).toMatchObject({ ok: false, passed: 1, failed: 1 });
    expect(run.args.skipped).toBeUndefined();
  });
});

describe("runFromMetadata with dependsOn", () => {
  it("skips dependents of a failure and keeps running independent scenarios", async () => {
    const events: Event[] = [];
    await expect(
      runFromMetadata({
        scenarios: [
          fail("setup"),
          pass("child", { dependsOn: ["setup"] }),
          pass("grandchild", { dependsOn: ["child"] }),
          pass("independent"),
        ],
        reporter: recordingReporter(events),
      }),
    ).rejects.toThrow();
    expect(events.filter((e) => e.type !== "run")).toEqual([
      expect.objectContaining({ type: "end", id: "setup", ok: false }),
      { type: "skip", id: "child", dependency: "setup" },
      { type: "skip", id: "grandchild", dependency: "child" },
      expect.objectContaining({ type: "end", id: "independent", ok: true }),
    ]);
    const run = events.find((e) => e.type === "run") as { args: RunEndArgs };
    expect(run.args).toMatchObject({ ok: false, total: 4, passed: 1, failed: 1, skipped: 2 });
  });

  it("runs a selected scenario's dependencies first", async () => {
    const events: Event[] = [];
    await runFromMetadata({
      scenarios: [pass("child", { dependsOn: ["parent"] }), pass("parent"), pass("unrelated")],
      scenarioIds: ["child"],
      reporter: recordingReporter(events),
    });
    expect(events.filter((e) => e.type === "end").map((e) => (e as any).id)).toEqual(["parent", "child"]);
  });
});

describe("runFromMetadata browser sessions", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Shows the stored token, so each scenario can assert which session it got.
    server = http.createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><body>
        <p id="who"></p>
        <button onclick="localStorage.setItem('token','t-1');document.getElementById('who').textContent='t-1'">Sign in</button>
        <script>document.getElementById('who').textContent = localStorage.getItem('token') || 'anonymous'</script>
      </body>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("restores a saved session and gives fresh scenarios an empty one", async () => {
    const events: Event[] = [];
    const ui = (id: string, extra: Partial<ScenarioSpec>, who: string): ScenarioSpec => ({
      id,
      type: "ui",
      steps: [
        { op: "ui.goto", with: { url: "/" } },
        { op: "ui.expectText", with: { selector: "#who", equals: who } },
      ],
      ...extra,
    });
    await runFromMetadata({
      scenarios: [
        {
          id: "login",
          type: "ui",
          saveSession: true,
          steps: [
            { op: "ui.goto", with: { url: "/" } },
            { op: "ui.click", with: { selector: "text=Sign in" } },
            { op: "ui.expectText", with: { selector: "#who", equals: "t-1" } },
          ],
        },
        ui("fresh", { session: "fresh" }, "anonymous"),
        ui("restored", { dependsOn: ["login"], session: "restore" }, "t-1"),
      ],
      ui: { baseUrl, recordVideo: false },
      reporter: recordingReporter(events),
    });
    expect(events.filter((e) => e.type === "end")).toEqual([
      expect.objectContaining({ id: "login", ok: true }),
      expect.objectContaining({ id: "fresh", ok: true }),
      expect.objectContaining({ id: "restored", ok: true }),
    ]);
  }, 60_000);
});
