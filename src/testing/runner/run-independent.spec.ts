// Purpose: the independent execution loop (R7): every scenario starts from an empty variable store and a new browser
// context, plus whatever its setup exports; dependsOn only gates; a failed setup blocks its consumers.

import * as http from "http";
import type { AddressInfo } from "net";

import type { ScenarioSpec, SetupSpec } from "../contracts/testing-metadata.types";
import { isChromiumInstalled } from "../adapters/ui/browser-provisioner";
import { RecordingReporter } from "./recording-reporter";
import { RunCanceledError } from "./run-cancellation";
import { runFromMetadata } from "./run-from-metadata";

class Recorder extends RecordingReporter {
  started?: { order?: string; shuffleSeed?: string; scenarioIds: string[]; setups?: Array<{ id: string }>; total: number };
  order: string[] = [];
  readonly ends: Array<{ id: string; ok: boolean; error?: string }> = [];
  onRunStart(args: NonNullable<Recorder["started"]>) {
    this.started = args;
  }
  onScenarioStart(...args: unknown[]) {
    this.order.push((args[0] as ScenarioSpec).id);
  }
  onScenarioEnd(scenario: ScenarioSpec, result: { ok: boolean; error?: unknown; heals?: unknown[] }) {
    super.onScenarioEnd(scenario, result);
    this.ends.push({ id: scenario.id, ok: result.ok, error: result.error ? String((result.error as Error).message ?? result.error) : undefined });
  }
}

const apiScenario = (id: string, steps: ScenarioSpec["steps"], extra: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id,
  type: "api",
  steps,
  ...extra,
});
const pass = (id: string, extra: Partial<ScenarioSpec> = {}) =>
  apiScenario(id, [{ op: "assert.equals", with: { actual: 1, expected: 1 } }], extra);
const fail = (id: string, extra: Partial<ScenarioSpec> = {}) =>
  apiScenario(id, [{ op: "assert.equals", with: { actual: 1, expected: 2 } }], extra);

const apiSetup = (id: string, extra: Partial<SetupSpec> = {}): SetupSpec => ({
  id,
  name: id,
  type: "api",
  steps: [{ op: "assert.equals", with: { actual: 1, expected: 1 } }],
  ...extra,
});

describe("runIndependent: isolation", () => {
  it("does not show one scenario's saveAs values to the next", async () => {
    const reporter = new Recorder();
    await expect(
      runFromMetadata({
        scenarios: [
          apiScenario("a", [{ op: "util.random", with: { generator: "emailAddress" }, saveAs: "foo" }]),
          apiScenario("b", [{ op: "assert.equals", with: { actual: "${res:foo}", expected: "x" } }]),
        ],
        reporter,
        failFast: false,
      }),
    ).rejects.toThrow();
    expect(reporter.ends).toEqual([
      { id: "a", ok: true, error: undefined },
      expect.objectContaining({ id: "b", ok: false, error: expect.stringContaining("Missing resource") }),
    ]);
  });

  it("gives a consumer a setup's exports, and nothing else the setup saved", async () => {
    const reporter = new Recorder();
    const setup = apiSetup("auth-api", {
      steps: [
        { op: "util.script", with: { script: "return { token: 'abc' };", input: {} }, saveAs: "login" },
        { op: "util.random", with: { generator: "emailAddress" }, saveAs: "hidden" },
      ],
      exports: ["login"],
    });
    await expect(
      runFromMetadata({
        setups: [setup],
        scenarios: [
          apiScenario("reads-export", [{ op: "assert.equals", with: { actual: "${res:login.token}", expected: "abc" } }], {
            restoreFrom: "auth-api",
          }),
          apiScenario("again", [{ op: "assert.equals", with: { actual: "${res:login.token}", expected: "abc" } }], {
            restoreFrom: "auth-api",
          }),
          apiScenario("reads-hidden", [{ op: "util.require", with: { resource: "hidden" } }], { restoreFrom: "auth-api" }),
        ],
        reporter,
        failFast: false,
      }),
    ).rejects.toThrow();
    expect(reporter.scenarioEnds).toEqual([
      { id: "reads-export", ok: true },
      { id: "again", ok: true },
      { id: "reads-hidden", ok: false },
    ]);
    // The run-scoped setup ran once and was reused.
    expect(reporter.setupEnds).toEqual([
      { setupId: "auth-api", ok: true, reused: false, attempt: 1 },
      { setupId: "auth-api", ok: true, reused: true, attempt: 0 },
      { setupId: "auth-api", ok: true, reused: true, attempt: 0 },
    ]);
    expect(reporter.scenarioSetups["again"]).toMatchObject({ id: "auth-api", reused: true, readyCheck: "passed" });
    expect(reporter.runEnd).toMatchObject({ ok: false, total: 3, passed: 2, failed: 1, blocked: 0 });
  });

  it("starts a retry from the setup's exports again, not from what the failed attempt changed", async () => {
    const reporter = new Recorder();
    // The step that decides pass or fail reads the attempt number, which the reporter sets as each attempt starts.
    const env: Record<string, string> = {};
    let attempts = 0;
    const start = reporter.onScenarioStart.bind(reporter);
    reporter.onScenarioStart = (...args: unknown[]) => {
      attempts += 1;
      env.ATTEMPT = String(attempts);
      start(...args);
    };
    const setup = apiSetup("auth-api", {
      steps: [{ op: "util.script", with: { script: "return { token: 'abc' };", input: {} }, saveAs: "login" }],
      exports: ["login"],
    });
    await runFromMetadata({
      setups: [setup],
      scenarios: [
        apiScenario(
          "retried",
          [
            { op: "assert.equals", with: { actual: "${res:login.token}", expected: "abc" } },
            // Changes the exported object in place, then fails on the first attempt.
            { op: "util.script", with: { script: "return 'changed';", input: {} }, saveAs: "login.token" },
            { op: "assert.equals", with: { actual: "${env:ATTEMPT}", expected: "2" } },
          ],
          { restoreFrom: "auth-api", retries: 1 },
        ),
        apiScenario("after", [{ op: "assert.equals", with: { actual: "${res:login.token}", expected: "abc" } }], {
          restoreFrom: "auth-api",
        }),
      ],
      env,
      reporter,
    });
    expect(reporter.scenarioEnds).toEqual([
      { id: "retried", ok: false },
      { id: "retried", ok: true },
      { id: "after", ok: true },
    ]);
    expect(reporter.scenarioSetups["retried"]).toMatchObject({ id: "auth-api", reused: false });
    expect(reporter.runEnd).toMatchObject({ ok: true, total: 2, passed: 2, failed: 0, blocked: 0 });
  });

  it("reports setup steps under setup:<id>, never under the consumer", async () => {
    const reporter = new Recorder();
    await runFromMetadata({ setups: [apiSetup("s1")], scenarios: [pass("a", { restoreFrom: "s1" })], reporter });
    expect(reporter.stepEnds).toEqual([
      expect.objectContaining({ scenarioId: "setup:s1", setup: "setup", ok: true }),
      expect.objectContaining({ scenarioId: "a", setup: undefined, ok: true }),
    ]);
  });

  it("does not count setups in the totals, and lists them in run.start", async () => {
    const reporter = new Recorder();
    await runFromMetadata({
      setups: [apiSetup("s1"), apiSetup("s2", { scope: "scenario" })],
      scenarios: [pass("a", { restoreFrom: "s1" }), pass("b", { restoreFrom: "s2" }), pass("c")],
      reporter,
    });
    expect(reporter.started).toMatchObject({ total: 3, order: "file", scenarioIds: ["a", "b", "c"] });
    expect(reporter.started?.setups?.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(reporter.runEnd).toMatchObject({ ok: true, total: 3, passed: 3, failed: 0, blocked: 0 });
  });
});

describe("runIndependent: dependsOn", () => {
  it("is a skip rule only: a selected scenario's gate is not added to the run", async () => {
    const reporter = new Recorder();
    await runFromMetadata({
      scenarios: [pass("a"), pass("b", { dependsOn: ["a"] })],
      scenarioIds: ["b"],
      reporter,
    });
    expect(reporter.ends.map((e) => e.id)).toEqual(["b"]);
    expect(reporter.blocked).toEqual([]);
  });

  it("blocks a scenario whose selected gate failed, and does not run it", async () => {
    const reporter = new Recorder();
    await expect(
      runFromMetadata({ scenarios: [fail("a"), pass("b", { dependsOn: ["a"] })], reporter, failFast: false }),
    ).rejects.toThrow();
    expect(reporter.blocked).toEqual([{ id: "b", blockedBy: { kind: "gate", id: "a" } }]);
    expect(reporter.ends.map((e) => e.id)).toEqual(["a"]);
    expect(reporter.runEnd).toMatchObject({ ok: false, total: 2, passed: 0, failed: 1, blocked: 1 });
  });

  it("runs a gate first even when the file lists it second", async () => {
    const reporter = new Recorder();
    await runFromMetadata({ scenarios: [pass("b", { dependsOn: ["a"] }), pass("a")], reporter });
    expect(reporter.order).toEqual(["a", "b"]);
  });
});

describe("runIndependent: failed setups", () => {
  it("blocks every consumer of a setup that fails twice, without counting them as failed", async () => {
    const reporter = new Recorder();
    const broken = apiSetup("auth-broken", { steps: [{ op: "assert.equals", with: { actual: 1, expected: 2 } }] });
    await expect(
      runFromMetadata({
        setups: [broken],
        scenarios: [pass("a", { restoreFrom: "auth-broken" }), pass("b", { restoreFrom: "auth-broken" }), pass("c")],
        reporter,
        failFast: false,
      }),
    ).rejects.toThrow(/blocked/);
    expect(reporter.blocked.map((b) => [b.id, b.blockedBy.kind, b.blockedBy.id])).toEqual([
      ["a", "setup", "auth-broken"],
      ["b", "setup", "auth-broken"],
    ]);
    expect(reporter.blocked[0].blockedBy.error).toMatch(/failed/);
    // Two attempts for the first consumer; the second consumer is blocked at once.
    expect(reporter.setupEnds.filter((e) => !e.ok)).toHaveLength(2);
    expect(reporter.ends.map((e) => e.id)).toEqual(["c"]);
    expect(reporter.runEnd).toMatchObject({ ok: false, total: 3, passed: 1, failed: 0, blocked: 2 });
  });

  it("does not let blocked scenarios stop a failFast run", async () => {
    const reporter = new Recorder();
    const broken = apiSetup("auth-broken", { steps: [{ op: "assert.equals", with: { actual: 1, expected: 2 } }] });
    await expect(
      runFromMetadata({ setups: [broken], scenarios: [pass("a", { restoreFrom: "auth-broken" }), pass("b")], reporter }),
    ).rejects.toThrow();
    expect(reporter.ends.map((e) => e.id)).toEqual(["b"]);
  });

  it("blocks a consumer whose parent setup failed, naming its own setup and the root cause", async () => {
    const reporter = new Recorder();
    const parent = apiSetup("parent", { name: "Parent", steps: [{ op: "assert.equals", with: { actual: 1, expected: 2 } }] });
    const child = apiSetup("child", { from: "parent" });
    await expect(
      runFromMetadata({ setups: [parent, child], scenarios: [pass("a", { restoreFrom: "child" })], reporter }),
    ).rejects.toThrow();
    expect(reporter.blocked[0].blockedBy).toMatchObject({ kind: "setup", id: "child" });
    expect(reporter.blocked[0].blockedBy.error).toContain('Setup "Parent" failed');
  });
});

describe("runIndependent: validation, order and dispatch", () => {
  it("fails a scenario with session shared, runs the others", async () => {
    const reporter = new Recorder();
    await expect(
      runFromMetadata({ scenarios: [pass("a", { session: "shared" }), pass("b")], reporter, failFast: false }),
    ).rejects.toThrow(/session "shared" is not allowed/);
    expect(reporter.ends).toEqual([
      expect.objectContaining({ id: "a", ok: false }),
      expect.objectContaining({ id: "b", ok: true }),
    ]);
    expect(reporter.runEnd).toMatchObject({ ok: false, total: 2, passed: 1, failed: 1 });
  });

  it("reports the same shuffled order for the same seed, and the seed in run.start", async () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const run = async (seed: string) => {
      const reporter = new Recorder();
      await runFromMetadata({ scenarios: ids.map((id) => pass(id)), reporter, order: "shuffle", shuffleSeed: seed });
      return reporter;
    };
    const first = await run("seed-1");
    const second = await run("seed-1");
    expect(first.order).toEqual(second.order);
    expect(first.started).toMatchObject({ order: "shuffle", shuffleSeed: "seed-1" });
    expect([...first.order].sort()).toEqual(ids);
    expect((await run("seed-2")).order).not.toEqual(first.order);
  });

  it("generates and reports a seed when shuffle has none, and treats any other order as file order", async () => {
    const shuffled = new Recorder();
    await runFromMetadata({ scenarios: [pass("a"), pass("b")], reporter: shuffled, order: "shuffle" });
    expect(shuffled.started?.shuffleSeed).toEqual(expect.any(String));
    const other = new Recorder();
    await runFromMetadata({ scenarios: [pass("a"), pass("b")], reporter: other, order: "random" as any });
    expect(other.started).toMatchObject({ order: "file" });
    expect(other.started?.shuffleSeed).toBeUndefined();
  });

  it("sends a run with a mobile step to the legacy path, even when the scenario is not typed mobile", async () => {
    const reporter = new Recorder();
    await expect(
      runFromMetadata({ scenarios: [apiScenario("m", [{ op: "mobile.tap", with: {} }], { type: "mixed" })], reporter }),
    ).rejects.toThrow(/mobile scenario but the run has no mobile options/);
  });

  it("stops at the next scenario when the run is canceled, and reports run.end", async () => {
    const controller = new AbortController();
    const reporter = new Recorder();
    const end = reporter.onScenarioEnd.bind(reporter);
    reporter.onScenarioEnd = (scenario, result) => {
      end(scenario, result);
      controller.abort();
    };
    await expect(
      runFromMetadata({ scenarios: [pass("a"), pass("b")], reporter, signal: controller.signal }),
    ).rejects.toBeInstanceOf(RunCanceledError);
    expect(reporter.ends.map((e) => e.id)).toEqual(["a"]);
    expect(reporter.runEnd).toMatchObject({ ok: false, passed: 1, failed: 0 });
  });
});

describe("runIndependent: teardown", () => {
  /** Records the order of scenario ends and teardown ends. */
  class Timeline extends Recorder {
    log: string[] = [];
    onScenarioEnd(scenario: ScenarioSpec, result: { ok: boolean; error?: unknown }) {
      super.onScenarioEnd(scenario, result);
      this.log.push(`end:${scenario.id}`);
    }
    onScenarioBlocked(scenario: ScenarioSpec, blockedBy: any) {
      super.onScenarioBlocked(scenario, blockedBy);
      this.log.push(`blocked:${scenario.id}`);
    }
    onTeardownEnd(args: { setupId: string; ok: boolean }) {
      super.onTeardownEnd(args);
      this.log.push(`teardown:${args.setupId}`);
    }
  }
  const ok = [{ op: "assert.equals", with: { actual: 1, expected: 1 } }] as ScenarioSpec["steps"];
  const bad = [{ op: "assert.equals", with: { actual: 1, expected: 2 } }] as ScenarioSpec["steps"];
  const withTeardown = (id: string, extra: Partial<SetupSpec> = {}) => apiSetup(id, { teardown: ok, ...extra });

  it("tears a run-scoped setup down once, right after its last consumer", async () => {
    const reporter = new Timeline();
    await runFromMetadata({
      setups: [withTeardown("s1")],
      scenarios: [pass("a", { restoreFrom: "s1" }), pass("b", { restoreFrom: "s1" }), pass("c")],
      reporter,
    });
    expect(reporter.log).toEqual(["end:a", "end:b", "teardown:s1", "end:c"]);
    expect(reporter.teardownEnds).toEqual([{ setupId: "s1", ok: true }]);
    // Teardown steps are reported under the setup, with their own paths.
    const steps = reporter.stepEnds.filter((e) => e.setup === "teardown");
    expect(steps).toEqual([expect.objectContaining({ scenarioId: "setup:s1", stepPath: "teardown[0]", ok: true })]);
  });

  it("tears a run-scoped setup down even when its last consumer fails, and when the setup was marked failed", async () => {
    const reporter = new Timeline();
    await expect(
      runFromMetadata({
        setups: [withTeardown("s1")],
        scenarios: [fail("a", { restoreFrom: "s1" })],
        reporter,
        failFast: false,
      }),
    ).rejects.toThrow();
    expect(reporter.log).toEqual(["end:a", "teardown:s1"]);
    expect(reporter.runEnd).toMatchObject({ passed: 0, failed: 1 });
  });

  it("tears a fresh setup down after each consumer, and a stored scope does not change that", async () => {
    const reporter = new Timeline();
    await runFromMetadata({
      setups: [withTeardown("s1", { scope: "scenario" })],
      scenarios: [
        pass("a", { restoreFrom: { setup: "s1", fresh: true } }),
        fail("b", { restoreFrom: { setup: "s1", fresh: true } }),
        pass("c", { restoreFrom: { setup: "s1", fresh: true } }),
      ],
      reporter,
      failFast: false,
    }).catch(() => undefined);
    expect(reporter.log).toEqual(["end:a", "teardown:s1", "end:b", "teardown:s1", "end:c", "teardown:s1"]);
  });

  it("tears down a fresh acquisition after its consumer, and the shared run setup after the last one", async () => {
    const reporter = new Timeline();
    await runFromMetadata({
      setups: [withTeardown("s1")],
      scenarios: [pass("a", { restoreFrom: { setup: "s1", fresh: true } }), pass("b", { restoreFrom: "s1" })],
      reporter,
    });
    expect(reporter.log).toEqual(["end:a", "teardown:s1", "end:b", "teardown:s1"]);
  });

  it("tears a child down before its parent", async () => {
    const reporter = new Timeline();
    await runFromMetadata({
      setups: [withTeardown("parent"), withTeardown("child", { from: "parent" })],
      scenarios: [pass("a", { restoreFrom: { setup: "child", fresh: true } })],
      reporter,
    });
    expect(reporter.log).toEqual(["end:a", "teardown:child", "teardown:parent"]);
  });

  it("tears a run-scoped child down before its run-scoped parent when both end at the same consumer", async () => {
    const reporter = new Timeline();
    await runFromMetadata({
      setups: [withTeardown("parent"), withTeardown("child", { from: "parent" })],
      scenarios: [pass("a", { restoreFrom: "parent" }), pass("b", { restoreFrom: "child" })],
      reporter,
    });
    expect(reporter.log).toEqual(["end:a", "end:b", "teardown:child", "teardown:parent"]);
  });

  it("still tears down setups that ran when failFast stops the run early", async () => {
    const reporter = new Timeline();
    await expect(
      runFromMetadata({
        setups: [withTeardown("s1"), withTeardown("s2")],
        scenarios: [pass("a", { restoreFrom: "s1" }), fail("b", { restoreFrom: { setup: "s2", fresh: true } }), pass("c", { restoreFrom: "s1" })],
        reporter,
      }),
    ).rejects.toThrow();
    expect(reporter.ends.map((e) => e.id)).toEqual(["a", "b"]);
    expect(reporter.log).toEqual(["end:a", "end:b", "teardown:s2", "teardown:s1"]);
  });

  it("tears down a setup whose consumers are all blocked by another setup only if it ran", async () => {
    const reporter = new Timeline();
    await expect(
      runFromMetadata({
        setups: [withTeardown("s1"), apiSetup("broken", { steps: bad, teardown: ok })],
        scenarios: [pass("a", { restoreFrom: "broken" })],
        reporter,
        failFast: false,
      }),
    ).rejects.toThrow(/blocked/);
    // A setup that never came up has nothing to undo; s1 was never used.
    expect(reporter.teardownEnds).toEqual([]);
  });

  it("reports a failing teardown without changing the totals or the run's outcome", async () => {
    const reporter = new Timeline();
    await runFromMetadata({
      setups: [withTeardown("s1", { teardown: bad })],
      scenarios: [pass("a", { restoreFrom: "s1" }), pass("b")],
      reporter,
    });
    expect(reporter.teardownEnds).toEqual([{ setupId: "s1", ok: false }]);
    expect(reporter.runEnd).toMatchObject({ ok: true, total: 2, passed: 2, failed: 0, blocked: 0 });
  });

  it("runs no teardown when the run is canceled", async () => {
    const controller = new AbortController();
    const reporter = new Timeline();
    const end = reporter.onScenarioEnd.bind(reporter);
    reporter.onScenarioEnd = (scenario, result) => {
      end(scenario, result);
      controller.abort();
    };
    await expect(
      runFromMetadata({
        setups: [withTeardown("s1"), withTeardown("s2", { scope: "scenario" })],
        scenarios: [pass("a", { restoreFrom: "s2" }), pass("b", { restoreFrom: "s1" })],
        reporter,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(RunCanceledError);
    expect(reporter.teardownEnds).toEqual([]);
    expect(reporter.stepEnds.filter((e) => e.setup === "teardown")).toEqual([]);
  });
});

// Needs a real Chromium; skipped (not failed) when it is not installed on this machine.
describe("runIndependent: browser", () => {
  let chromiumAvailable = false;
  let server: http.Server;
  let baseUrl = "";
  const sessions = new Set<string>();
  let nextSession = 1;
  /** How many more times /gate answers "not ready" before it answers "ready". */
  let gateNotReady = 0;

  const cookieSession = (req: http.IncomingMessage): string | undefined => {
    const match = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie ?? "");
    return match && sessions.has(match[1]) ? match[1] : undefined;
  };

  beforeAll(async () => {
    chromiumAvailable = await isChromiumInstalled().catch(() => false);
    server = http.createServer((req, res) => {
      const url = req.url ?? "/";
      if (url === "/do-login") {
        const sid = `s${nextSession++}`;
        sessions.add(sid);
        res.writeHead(302, { "set-cookie": `sid=${sid}; Path=/`, location: "/" });
        res.end();
        return;
      }
      if (url === "/do-logout") {
        // Logging out ends the session on the server: every browser holding it is signed out.
        const sid = cookieSession(req);
        if (sid) sessions.delete(sid);
        res.writeHead(302, { "set-cookie": "sid=; Path=/; Max-Age=0", location: "/" });
        res.end();
        return;
      }
      res.setHeader("content-type", "text/html");
      if (url === "/search") {
        res.end(`<!doctype html><body><p id="search">${cookieSession(req) ? "search ok" : "login required"}</p></body>`);
        return;
      }
      if (url === "/gate") {
        const ready = gateNotReady <= 0;
        gateNotReady -= 1;
        res.end(`<!doctype html><body><p id="gate">${ready ? "ready" : "not ready"}</p></body>`);
        return;
      }
      res.end(`<!doctype html><body>
        <p id="who">${cookieSession(req) ? "user" : "anon"}</p>
        <a href="/do-login">Log in</a> <a href="/do-logout">Log out</a>
      </body>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const goto = (url: string) => ({ op: "ui.goto", with: { url } });
  const expectText = (selector: string, equals: string) => ({ op: "ui.expectText", with: { selector, equals } });
  const signIn: SetupSpec = {
    id: "auth-default",
    name: "Signed in as the default user",
    type: "ui",
    scope: "run",
    steps: [goto("/"), { op: "ui.click", with: { selector: "text=Log in" } }, expectText("#who", "user")],
    ready: [goto("/"), expectText("#who", "user")],
  };
  const login: ScenarioSpec = {
    id: "login",
    type: "ui",
    steps: [goto("/"), expectText("#who", "anon"), { op: "ui.click", with: { selector: "text=Log in" } }, expectText("#who", "user")],
  };
  const search: ScenarioSpec = {
    id: "search",
    type: "ui",
    restoreFrom: "auth-default",
    steps: [goto("/search"), expectText("#search", "search ok")],
  };
  const logout: ScenarioSpec = {
    id: "logout",
    type: "ui",
    restoreFrom: { setup: "auth-default", fresh: true },
    steps: [goto("/"), { op: "ui.click", with: { selector: "text=Log out" } }, expectText("#who", "anon"), goto("/search"), expectText("#search", "login required")],
  };

  const permutations = <T,>(items: T[]): T[][] =>
    items.length <= 1 ? [items] : items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));

  it("passes Login, Search and Logout in all six orders: a fresh logout does not sign the others out", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the browser run test");
      return;
    }
    for (const scenarios of permutations([login, search, logout])) {
      sessions.clear();
      const reporter = new Recorder();
      await runFromMetadata({ scenarios, setups: [signIn], ui: { baseUrl, recordVideo: false }, reporter, failFast: false });
      expect(reporter.ends.map((e) => [e.id, e.ok, e.error])).toEqual(scenarios.map((s) => [s.id, true, undefined]));
      expect(reporter.runEnd).toMatchObject({ ok: true, total: 3, passed: 3, failed: 0, blocked: 0 });
      // Search's shared sign-in is never ended by Logout, so its ready check never needs a retry.
      expect(reporter.scenarioSetups["search"]).toMatchObject({ readyCheck: "passed" });
      expect(reporter.scenarioSetups["logout"]).toMatchObject({ reused: false, readyCheck: "passed" });
    }
  }, 240_000);

  it("runs a retry in a new browser context, not in the one the failed attempt signed in", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the browser run test");
      return;
    }
    const env: Record<string, string> = {};
    let attempts = 0;
    const reporter = new Recorder();
    const start = reporter.onScenarioStart.bind(reporter);
    reporter.onScenarioStart = (...args: unknown[]) => {
      attempts += 1;
      env.ATTEMPT = String(attempts);
      start(...args);
    };
    await runFromMetadata({
      scenarios: [{ ...login, retries: 1, steps: [...login.steps, { op: "assert.equals", with: { actual: "${env:ATTEMPT}", expected: "2" } }] }],
      ui: { baseUrl, recordVideo: false },
      env,
      reporter,
    });
    expect(reporter.scenarioEnds).toEqual([
      { id: "login", ok: false },
      { id: "login", ok: true },
    ]);
  }, 120_000);

  it("re-runs a setup once when its ready check fails, then passes the scenario", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the browser run test");
      return;
    }
    gateNotReady = 1;
    const reporter = new Recorder();
    const setup: SetupSpec = { ...signIn, ready: [goto("/gate"), expectText("#gate", "ready")] };
    await runFromMetadata({
      scenarios: [search],
      setups: [setup],
      ui: { baseUrl, recordVideo: false },
      reporter,
    });
    expect(reporter.scenarioEnds).toEqual([{ id: "search", ok: true }]);
    expect(reporter.scenarioSetups["search"]).toMatchObject({ id: "auth-default", reused: false, readyCheck: "retried" });
    expect(reporter.setupEnds.filter((e) => e.ok && !e.reused)).toHaveLength(2);
    expect(reporter.runEnd).toMatchObject({ ok: true, passed: 1, failed: 0, blocked: 0 });
  }, 120_000);

  it("refreshes a stale parent session when a child's ready check fails, and tears down in a signed-in context", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the browser run test");
      return;
    }
    sessions.clear();
    // The child inherits the parent's session cookie. Signing the shared session out on the server makes both stale:
    // re-running only the child would build on the dead parent session and fail its ready check again.
    const child: SetupSpec = {
      id: "on-search",
      name: "On the search page",
      type: "ui",
      scope: "run",
      from: "auth-default",
      steps: [goto("/search"), expectText("#search", "search ok")],
      ready: [goto("/search"), expectText("#search", "search ok")],
      // Runs in a new context seeded from the setup's state: signed in.
      teardown: [goto("/"), expectText("#who", "user")],
    };
    const searchChild = (id: string): ScenarioSpec => ({ ...search, id, restoreFrom: "on-search" });
    const signOutShared: ScenarioSpec = {
      id: "sign-out-shared",
      type: "ui",
      restoreFrom: "auth-default",
      steps: [goto("/"), { op: "ui.click", with: { selector: "text=Log out" } }, expectText("#who", "anon")],
    };
    const reporter = new Recorder();
    await runFromMetadata({
      scenarios: [searchChild("search-1"), signOutShared, searchChild("search-2")],
      setups: [signIn, child],
      ui: { baseUrl, recordVideo: false },
      reporter,
    });
    expect(reporter.ends.map((e) => [e.id, e.ok, e.error])).toEqual([
      ["search-1", true, undefined],
      ["sign-out-shared", true, undefined],
      ["search-2", true, undefined],
    ]);
    expect(reporter.scenarioSetups["search-2"]).toMatchObject({ id: "on-search", reused: false, readyCheck: "retried" });
    // The parent ran twice: once at the start and again after search-2's failed ready check.
    expect(reporter.setupEnds.filter((e) => e.setupId === "auth-default" && e.ok && !e.reused)).toHaveLength(2);
    // Both runs of the child are torn down after its last consumer; the first one's session was signed out.
    expect(reporter.teardownEnds).toEqual([
      { setupId: "on-search", ok: true },
      { setupId: "on-search", ok: false },
    ]);
    expect(reporter.runEnd).toMatchObject({ ok: true, passed: 3, failed: 0, blocked: 0 });
  }, 120_000);

  it("blocks the consumer when the ready check fails again after the setup is re-run", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the browser run test");
      return;
    }
    gateNotReady = 100;
    const reporter = new Recorder();
    const setup: SetupSpec = { ...signIn, ready: [goto("/gate"), expectText("#gate", "ready")] };
    await expect(
      runFromMetadata({
        scenarios: [search, pass("api-one")],
        setups: [setup],
        ui: { baseUrl, recordVideo: false },
        reporter,
        failFast: false,
      }),
    ).rejects.toThrow(/blocked/);
    expect(reporter.blocked).toEqual([
      { id: "search", blockedBy: { kind: "setup", id: "auth-default", error: expect.stringContaining("is not ready") } },
    ]);
    expect(reporter.ends.map((e) => e.id)).toEqual(["api-one"]);
    expect(reporter.runEnd).toMatchObject({ ok: false, total: 2, passed: 1, failed: 0, blocked: 1 });
  }, 120_000);
});
