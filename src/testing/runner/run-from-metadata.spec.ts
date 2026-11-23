// Purpose: a run stops at the first failed scenario by default; failFast: false runs every
// scenario and still reports the run as failed. For ui and api runs, dependsOn only gates (a failure
// blocks its dependents) and a browser session comes only from a setup. The legacy path (any run with a
// mobile scenario) keeps the old rules: dependsOn pulls scenarios in and skips, and saved sessions restore.

import * as http from "http";
import type { AddressInfo } from "net";

import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import type { Reporter, RunEndArgs, ScenarioResult, ScenarioSkipInfo } from "../reporter/reporter.types";
import { runFromMetadata } from "./run-from-metadata";
import { runLegacy } from "./run-legacy";

function scenario(id: string, passes: boolean): ScenarioSpec {
  return {
    id,
    type: "api",
    steps: [{ op: "assert.equals", with: { actual: 1, expected: passes ? 1 : 2 } }],
  };
}

function recorder() {
  const ended: Array<{ id: string; ok: boolean }> = [];
  let runEnd: Parameters<NonNullable<Reporter["onRunEnd"]>>[0] | undefined;
  const reporter: Reporter = {
    onScenarioStart: () => undefined,
    onScenarioEnd: (s, r) => {
      ended.push({ id: s.id, ok: r.ok });
    },
    onStepStart: () => undefined,
    onStepEnd: () => undefined,
    onRunEnd: (r) => {
      runEnd = r;
    },
  };
  return { reporter, ended, getRunEnd: () => runEnd };
}

describe("runFromMetadata: failFast", () => {
  const scenarios = [scenario("a", true), scenario("b", false), scenario("c", true)];

  it("stops at the first failed scenario by default", async () => {
    const { reporter, ended, getRunEnd } = recorder();

    await expect(runFromMetadata({ scenarios, reporter })).rejects.toThrow();

    expect(ended.map((e) => e.id)).toEqual(["a", "b"]);
    expect(getRunEnd()).toMatchObject({ ok: false, total: 3, passed: 1, failed: 1 });
  });

  it("stops at the first failed scenario when failFast is true", async () => {
    const { reporter, ended } = recorder();

    await expect(runFromMetadata({ scenarios, reporter, failFast: true })).rejects.toThrow();

    expect(ended.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("runs every scenario when failFast is false, then still fails the run", async () => {
    const { reporter, ended, getRunEnd } = recorder();

    await expect(runFromMetadata({ scenarios, reporter, failFast: false })).rejects.toThrow();

    expect(ended).toEqual([
      { id: "a", ok: true },
      { id: "b", ok: false },
      { id: "c", ok: true },
    ]);
    expect(getRunEnd()).toMatchObject({ ok: false, total: 3, passed: 2, failed: 1 });
  });

  it("rethrows the first failure when several scenarios fail", async () => {
    const { reporter, getRunEnd } = recorder();
    const many = [scenario("a", false), scenario("b", true), scenario("c", false)];

    await expect(runFromMetadata({ scenarios: many, reporter, failFast: false })).rejects.toThrow();

    expect(getRunEnd()).toMatchObject({ ok: false, total: 3, passed: 1, failed: 2 });
  });

  it("does not throw when failFast is false and everything passes", async () => {
    const { reporter, getRunEnd } = recorder();

    await runFromMetadata({ scenarios: [scenario("a", true), scenario("b", true)], reporter, failFast: false });

    expect(getRunEnd()).toMatchObject({ ok: true, total: 2, passed: 2, failed: 0 });
  });
});

type Event =
  | { type: "end"; id: string; ok: boolean; error?: string }
  | { type: "skip"; id: string; dependency: string }
  | { type: "blocked"; id: string; kind: string; blockedId: string }
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
    onScenarioBlocked(scenario: ScenarioSpec, blockedBy: { kind: string; id: string }) {
      events.push({ type: "blocked", id: scenario.id, kind: blockedBy.kind, blockedId: blockedBy.id });
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
  it("stops at the first failure by default, like a run without dependencies", async () => {
    const events: Event[] = [];
    await expect(
      runFromMetadata({
        scenarios: [pass("login"), pass("a", { dependsOn: ["login"] }), fail("b", { dependsOn: ["login"] }), pass("c", { dependsOn: ["login"] })],
        reporter: recordingReporter(events),
      }),
    ).rejects.toThrow(/Expected values to be equal/);
    expect(events.filter((e) => e.type !== "run").map((e) => `${e.type}:${(e as any).id}`)).toEqual(["end:login", "end:a", "end:b"]);
    const run = events.find((e) => e.type === "run") as { args: RunEndArgs };
    expect(run.args).toMatchObject({ ok: false, total: 4, passed: 2, failed: 1, blocked: 0 });
  });

  it("with failFast off, blocks dependents of a failure and keeps running independent scenarios", async () => {
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
        failFast: false,
      }),
    ).rejects.toThrow();
    expect(events.filter((e) => e.type !== "run")).toEqual([
      expect.objectContaining({ type: "end", id: "setup", ok: false }),
      { type: "blocked", id: "child", kind: "gate", blockedId: "setup" },
      { type: "blocked", id: "grandchild", kind: "gate", blockedId: "child" },
      expect.objectContaining({ type: "end", id: "independent", ok: true }),
    ]);
    const run = events.find((e) => e.type === "run") as { args: RunEndArgs };
    expect(run.args).toMatchObject({ ok: false, total: 4, passed: 1, failed: 1, blocked: 2 });
  });

  it("fails only a scenario whose restoreFrom names an unknown setup, blocks what gates on it, and runs the rest", async () => {
    const events: Event[] = [];
    await expect(
      runFromMetadata({
        scenarios: [
          pass("login"),
          pass("workspace", { restoreFrom: "ui-login" }),
          pass("after-workspace", { dependsOn: ["workspace"] }),
          pass("other", { dependsOn: ["login"] }),
        ],
        reporter: recordingReporter(events),
      }),
    ).rejects.toThrow(/restoreFrom names unknown setup "ui-login"/);
    expect(events.filter((e) => e.type !== "run")).toEqual([
      expect.objectContaining({ type: "end", id: "workspace", ok: false }),
      expect.objectContaining({ type: "end", id: "login", ok: true }),
      { type: "blocked", id: "after-workspace", kind: "gate", blockedId: "workspace" },
      expect.objectContaining({ type: "end", id: "other", ok: true }),
    ]);
    const run = events.find((e) => e.type === "run") as { args: RunEndArgs };
    expect(run.args).toMatchObject({ ok: false, total: 4, passed: 2, failed: 1, blocked: 1 });
  });

  it("reports a broken scenario only when the run selected it or something that needs it", async () => {
    const events: Event[] = [];
    await runFromMetadata({
      scenarios: [pass("login"), pass("workspace", { dependsOn: ["ghost"] })],
      scenarioIds: ["login"],
      reporter: recordingReporter(events),
    });
    expect(events.filter((e) => e.type !== "run").map((e) => `${e.type}:${(e as any).id}`)).toEqual(["end:login"]);
  });

  it("does not add a dependsOn target to the run: it is a skip rule only", async () => {
    const events: Event[] = [];
    await runFromMetadata({
      scenarios: [pass("child", { dependsOn: ["parent"] }), pass("parent"), pass("unrelated")],
      scenarioIds: ["child"],
      reporter: recordingReporter(events),
    });
    expect(events.filter((e) => e.type === "end").map((e) => (e as any).id)).toEqual(["child"]);
  });

  it("runs a gating scenario first when both are selected", async () => {
    const events: Event[] = [];
    await runFromMetadata({
      scenarios: [pass("child", { dependsOn: ["parent"] }), pass("parent")],
      reporter: recordingReporter(events),
    });
    expect(events.filter((e) => e.type === "end").map((e) => (e as any).id)).toEqual(["parent", "child"]);
  });
});

// The legacy path runs every run that contains a mobile scenario, ui and api scenarios included. Called directly here,
// so its dependsOn, restoreFrom and session rules stay covered now that ui and api runs no longer reach it.
describe("runLegacy with dependsOn", () => {
  it("with failFast off, skips dependents of a failure and keeps running independent scenarios", async () => {
    const events: Event[] = [];
    await expect(
      runLegacy({
        scenarios: [
          fail("setup"),
          pass("child", { dependsOn: ["setup"] }),
          pass("grandchild", { dependsOn: ["child"] }),
          pass("independent"),
        ],
        reporter: recordingReporter(events),
        failFast: false,
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

  it("fails only a scenario whose restoreFrom names an unknown scenario, skips what needs it, and runs the rest", async () => {
    const events: Event[] = [];
    await expect(
      runLegacy({
        scenarios: [
          pass("login"),
          pass("workspace", { restoreFrom: "ui-login" }),
          pass("after-workspace", { dependsOn: ["workspace"] }),
          pass("other", { dependsOn: ["login"] }),
        ],
        reporter: recordingReporter(events),
      }),
    ).rejects.toThrow(/restores from unknown scenario "ui-login"/);
    expect(events.filter((e) => e.type !== "run")).toEqual([
      expect.objectContaining({ type: "end", id: "workspace", ok: false }),
      { type: "skip", id: "after-workspace", dependency: "workspace" },
      expect.objectContaining({ type: "end", id: "login", ok: true }),
      expect.objectContaining({ type: "end", id: "other", ok: true }),
    ]);
    const run = events.find((e) => e.type === "run") as { args: RunEndArgs };
    expect(run.args).toMatchObject({ ok: false, total: 4, passed: 2, failed: 1, skipped: 1 });
  });

  it("runs a selected scenario's dependencies first", async () => {
    const events: Event[] = [];
    await runLegacy({
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

  it("restores a setup's session and gives scenarios without a setup an empty one", async () => {
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
      scenarios: [ui("plain", {}, "anonymous"), ui("restored", { restoreFrom: "auth-t" }, "t-1"), ui("plain-again", {}, "anonymous")],
      setups: [
        {
          id: "auth-t",
          name: "Signed in",
          type: "ui",
          scope: "run",
          steps: [
            { op: "ui.goto", with: { url: "/" } },
            { op: "ui.click", with: { selector: "text=Sign in" } },
            { op: "ui.expectText", with: { selector: "#who", equals: "t-1" } },
          ],
          ready: [
            { op: "ui.goto", with: { url: "/" } },
            { op: "ui.expectText", with: { selector: "#who", equals: "t-1" } },
          ],
        },
      ],
      ui: { baseUrl, recordVideo: false },
      reporter: recordingReporter(events),
    });
    expect(events.filter((e) => e.type === "end")).toEqual([
      expect.objectContaining({ id: "plain", ok: true }),
      expect.objectContaining({ id: "restored", ok: true }),
      expect.objectContaining({ id: "plain-again", ok: true }),
    ]);
  }, 60_000);

  it("fails a scenario whose restoreFrom names a scenario, telling it to run the migration", async () => {
    const events: Event[] = [];
    await expect(
      runFromMetadata({
        scenarios: [
          { id: "login", type: "ui", steps: [{ op: "ui.goto", with: { url: "/" } }] },
          { id: "restored", type: "ui", restoreFrom: "login", steps: [{ op: "ui.goto", with: { url: "/" } }] },
        ],
        ui: { baseUrl, recordVideo: false },
        reporter: recordingReporter(events),
        failFast: false,
      }),
    ).rejects.toThrow(/restoreFrom must name a setup; run the migration/);
    expect(events.filter((e) => e.type === "end")).toEqual([
      expect.objectContaining({ id: "restored", ok: false }),
      expect.objectContaining({ id: "login", ok: true }),
    ]);
  }, 60_000);

  describe("on the legacy path", () => {
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
      await runLegacy({
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

    it("restoreFrom restores the named scenario's session with no saveSession or dependsOn written", async () => {
      const events: Event[] = [];
      await runLegacy({
        scenarios: [
          {
            id: "restored",
            type: "ui",
            restoreFrom: "login",
            steps: [
              { op: "ui.goto", with: { url: "/" } },
              { op: "ui.expectText", with: { selector: "#who", equals: "t-1" } },
            ],
          },
          {
            id: "login",
            type: "ui",
            steps: [
              { op: "ui.goto", with: { url: "/" } },
              { op: "ui.click", with: { selector: "text=Sign in" } },
              { op: "ui.expectText", with: { selector: "#who", equals: "t-1" } },
            ],
          },
        ],
        ui: { baseUrl, recordVideo: false },
        reporter: recordingReporter(events),
      });
      expect(events.filter((e) => e.type === "end")).toEqual([
        expect.objectContaining({ id: "login", ok: true }),
        expect.objectContaining({ id: "restored", ok: true }),
      ]);
    }, 60_000);
  });

  describe("whole-run video", () => {
    const uiScenario: ScenarioSpec = {
      id: "open",
      type: "ui",
      steps: [
        { op: "ui.goto", with: { url: "/" } },
        { op: "ui.expectText", with: { selector: "#who", equals: "anonymous" } },
      ],
    };

    async function keptArtifactNames(keepVideo: "failed" | "always" | undefined, scenarios: ScenarioSpec[]): Promise<string[]> {
      const kept: string[] = [];
      const base = recordingReporter([]);
      const reporter: Reporter = {
        ...base,
        attachRunArtifact: (args: { name: string }) => void kept.push(args.name),
      };
      await runFromMetadata({ scenarios, ui: { baseUrl, recordVideo: true }, reporter, keepVideo });
      return kept.filter((name) => name.endsWith(".webm"));
    }

    it("discards the video of a passing run by default", async () => {
      expect(await keptArtifactNames(undefined, [uiScenario])).toEqual([]);
    }, 60_000);

    it("keeps the video of a passing run when keepVideo is always", async () => {
      expect((await keptArtifactNames("always", [uiScenario])).length).toBeGreaterThan(0);
    }, 60_000);

    it("keeps no video for a run with only API scenarios, even when keepVideo is always", async () => {
      expect(await keptArtifactNames("always", [pass("api-only")])).toEqual([]);
    }, 60_000);
  });
});
