import type { SetupSpec, StepBlock } from "../contracts/testing-metadata.types";
import { SetupFailedError, SetupManager, type SetupManagerDeps } from "./setup-manager";
import { InMemorySessionStore, type SetupState } from "./session-store";

const STEP: StepBlock = { given: { op: "api.get", with: { path: "/" } } };

function setup(id: string, extra: Partial<SetupSpec> = {}): SetupSpec {
  return { id, name: id, type: "api", scope: "run", steps: [STEP], ...extra } as SetupSpec;
}

type RunStepsArgs = Parameters<SetupManagerDeps["runSteps"]>[0];

interface FakeOptions {
  /** Setup id → number of attempts that throw before one succeeds. */
  failures?: Record<string, number>;
  /** Setup id → resources the setup's steps saved. */
  resources?: Record<string, Record<string, unknown>>;
  /** Setup id → browser state the setup returns. */
  state?: Record<string, SetupState>;
}

function build(setups: SetupSpec[], opts: FakeOptions = {}) {
  const failuresLeft: Record<string, number> = { ...opts.failures };
  const calls: RunStepsArgs[] = [];
  const runSteps = jest.fn(async (args: RunStepsArgs) => {
    calls.push(args);
    if ((failuresLeft[args.setup.id] ?? 0) > 0) {
      failuresLeft[args.setup.id]--;
      throw new Error(`boom ${args.setup.id}\nsecond line`);
    }
    return {
      state: opts.state?.[args.setup.id],
      resources: { ...opts.resources?.[args.setup.id] },
    };
  });
  const onSetupStart = jest.fn();
  const onSetupEnd = jest.fn();
  const reporter = {
    onScenarioStart: jest.fn(),
    onScenarioEnd: jest.fn(),
    onStepStart: jest.fn(),
    onStepEnd: jest.fn(),
    onSetupStart,
    onSetupEnd,
  };
  const store = new InMemorySessionStore();
  const manager = new SetupManager({
    setups: new Map(setups.map((s) => [s.id, s])),
    store,
    applicationKey: "app",
    runSteps,
    reporter,
  });
  return { manager, runSteps, calls, onSetupStart, onSetupEnd, store };
}

describe("SetupManager", () => {
  it("runs a run-scoped setup once for three consumers", async () => {
    const { manager, runSteps, onSetupEnd } = build([setup("auth-default")]);

    const first = await manager.acquire("auth-default", { forScenarioId: "s1", fresh: false });
    const second = await manager.acquire("auth-default", { forScenarioId: "s2", fresh: false });
    const third = await manager.acquire("auth-default", { forScenarioId: "s3", fresh: false });

    expect(runSteps).toHaveBeenCalledTimes(1);
    expect([first.reused, second.reused, third.reused]).toEqual([false, true, true]);
    expect(second.state).toEqual(first.state);
    expect(onSetupEnd).toHaveBeenNthCalledWith(2, expect.objectContaining({ attempt: 0, reused: true, forScenarioId: "s2" }));
    expect(onSetupEnd).toHaveBeenCalledTimes(3);
  });

  it("runs a scenario-scoped setup once for every consumer and does not cache it", async () => {
    const { manager, runSteps } = build([setup("project-exists", { scope: "scenario" })]);

    for (const id of ["s1", "s2", "s3"]) {
      const result = await manager.acquire("project-exists", { forScenarioId: id, fresh: false });
      expect(result.reused).toBe(false);
    }

    expect(runSteps).toHaveBeenCalledTimes(3);
    expect(manager.ranWithTeardown()).toEqual([]);
  });

  it("runs a run-scoped setup again for fresh and does not replace the cached state", async () => {
    const { manager, runSteps } = build([setup("auth-default")]);

    const original = await manager.acquire("auth-default", { forScenarioId: "s1", fresh: false });
    const fresh = await manager.acquire("auth-default", { forScenarioId: "s2", fresh: true });
    const later = await manager.acquire("auth-default", { forScenarioId: "s3", fresh: false });

    expect(runSteps).toHaveBeenCalledTimes(2);
    expect(fresh.reused).toBe(false);
    expect(later.reused).toBe(true);
    expect(later.state).toEqual(original.state);
  });

  it("runs a run-scoped parent once and its scenario-scoped child per consumer", async () => {
    const { manager, calls } = build(
      [setup("auth-default", { exports: ["login"] }), setup("project-exists", { from: "auth-default", scope: "scenario" })],
      { resources: { "auth-default": { login: "t" } } },
    );

    await manager.acquire("project-exists", { forScenarioId: "s1", fresh: false });
    await manager.acquire("project-exists", { forScenarioId: "s2", fresh: false });

    expect(calls.map((c) => c.setup.id)).toEqual(["auth-default", "project-exists", "project-exists"]);
    expect(calls[0].startFrom).toBeUndefined();
    expect(calls[1].startFrom?.exports).toEqual({ login: "t" });
    expect(calls[2].startFrom?.exports).toEqual({ login: "t" });
  });

  it("marks a setup failed after two failed attempts and throws at once on the next acquire", async () => {
    const { manager, runSteps, onSetupEnd } = build([setup("bad", { name: "Bad setup" })], { failures: { bad: 2 } });

    const error = await manager.acquire("bad", { forScenarioId: "s1", fresh: false }).catch((e) => e);
    expect(error).toBeInstanceOf(SetupFailedError);
    expect(error.setupId).toBe("bad");
    expect(error.message).toBe('Setup "Bad setup" failed: boom bad');
    expect(runSteps).toHaveBeenCalledTimes(2);
    expect(onSetupEnd).toHaveBeenCalledTimes(2);

    await expect(manager.acquire("bad", { forScenarioId: "s2", fresh: false })).rejects.toBeInstanceOf(SetupFailedError);
    expect(runSteps).toHaveBeenCalledTimes(2);
  });

  it("does not mark a setup failed when its second attempt passes", async () => {
    const { manager, runSteps, onSetupStart, onSetupEnd } = build([setup("flaky")], { failures: { flaky: 1 } });

    const result = await manager.acquire("flaky", { forScenarioId: "s1", fresh: false });

    expect(result.reused).toBe(false);
    expect(runSteps).toHaveBeenCalledTimes(2);
    expect(onSetupStart.mock.calls.map((c) => c[0].attempt)).toEqual([1, 2]);
    expect(onSetupEnd).toHaveBeenCalledTimes(2);
    expect(onSetupEnd.mock.calls[0][0]).toEqual(expect.objectContaining({ attempt: 1, ok: false, error: "boom flaky\nsecond line" }));
    expect(onSetupEnd.mock.calls[1][0]).toEqual(expect.objectContaining({ attempt: 2, ok: true }));
    await manager.acquire("flaky", { forScenarioId: "s2", fresh: false });
    expect(runSteps).toHaveBeenCalledTimes(2);
  });

  it("blocks a child when its parent cannot be brought up, without running the child", async () => {
    const { manager, runSteps } = build(
      [setup("auth-default"), setup("project-exists", { from: "auth-default", scope: "scenario" })],
      { failures: { "auth-default": 2 } },
    );

    const error = await manager.acquire("project-exists", { forScenarioId: "s1", fresh: false }).catch((e) => e);

    expect(error).toBeInstanceOf(SetupFailedError);
    expect(error.setupId).toBe("auth-default");
    expect(runSteps.mock.calls.map((c) => c[0].setup.id)).toEqual(["auth-default", "auth-default"]);
  });

  it("gives a consumer its parent's exports and its own, and not unlisted saves", async () => {
    const { manager } = build(
      [
        setup("auth-default", { exports: ["login"] }),
        setup("project-exists", { from: "auth-default", scope: "scenario", exports: ["projectId"] }),
      ],
      {
        resources: {
          "auth-default": { login: { token: "t" }, other: "not exported" },
          "project-exists": { projectId: 7, secret: "not exported" },
        },
      },
    );

    const { state } = await manager.acquire("project-exists", { forScenarioId: "s1", fresh: false });

    expect(state.exports).toEqual({ login: { token: "t" }, projectId: 7 });
  });

  it("carries browser state into a child and returns the child's own state", async () => {
    const parentState: SetupState = { exports: {}, sessionStorage: { "https://app": { a: "1" } } };
    const { manager, calls } = build(
      [setup("auth-default", { type: "ui" }), setup("project-exists", { from: "auth-default", type: "ui", scope: "scenario" })],
      { state: { "auth-default": parentState } },
    );

    const { state } = await manager.acquire("project-exists", { forScenarioId: "s1", fresh: false });

    expect(calls[1].startFrom?.sessionStorage).toEqual({ "https://app": { a: "1" } });
    expect(state.sessionStorage).toEqual({ "https://app": { a: "1" } });
  });

  it("runs the steps again after invalidate", async () => {
    const { manager, runSteps } = build([setup("auth-default")]);

    await manager.acquire("auth-default", { forScenarioId: "s1", fresh: false });
    manager.invalidate("auth-default");
    const again = await manager.acquire("auth-default", { forScenarioId: "s2", fresh: false });

    expect(runSteps).toHaveBeenCalledTimes(2);
    expect(again.reused).toBe(false);
  });

  it("refuses an acquire for a setup marked failed with markFailed", async () => {
    const { manager, runSteps } = build([setup("auth-default")]);

    manager.markFailed("auth-default", "Setup failed earlier");

    await expect(manager.acquire("auth-default", { forScenarioId: "s1", fresh: false })).rejects.toThrow(
      "Setup failed earlier",
    );
    expect(runSteps).not.toHaveBeenCalled();
  });

  it("lists only run-scoped setups that ran and have teardown steps", async () => {
    const teardown = [STEP];
    const { manager } = build([
      setup("auth-default", { teardown }),
      setup("project-exists", { from: "auth-default", scope: "scenario", teardown }),
      setup("no-teardown"),
    ]);

    await manager.acquire("project-exists", { forScenarioId: "s1", fresh: false });
    await manager.acquire("no-teardown", { forScenarioId: "s1", fresh: false });
    await manager.acquire("auth-default", { forScenarioId: "s1", fresh: false });

    expect(manager.ranWithTeardown().map((r) => r.setupId)).toEqual(["auth-default"]);
  });

  it("does not list a fresh run-scoped setup for teardown", async () => {
    const { manager } = build([setup("auth-default", { teardown: [STEP] })]);

    await manager.acquire("auth-default", { forScenarioId: "s1", fresh: true });

    expect(manager.ranWithTeardown()).toEqual([]);
  });

  it("gives every consumer its own copy, so changing it does not leak into the cache or other consumers", async () => {
    const { manager } = build([setup("auth-default", { type: "ui", exports: ["login"] })], {
      resources: { "auth-default": { login: { token: "t" } } },
      state: { "auth-default": { exports: {}, sessionStorage: { "https://app": { a: "1" } } } },
    });

    const first = await manager.acquire("auth-default", { forScenarioId: "s1", fresh: false });
    (first.state.exports.login as { token: string }).token = "changed";
    first.state.sessionStorage!["https://app"].a = "changed";
    const second = await manager.acquire("auth-default", { forScenarioId: "s2", fresh: false });
    (second.state.exports.login as { token: string }).token = "changed again";
    const third = await manager.acquire("auth-default", { forScenarioId: "s3", fresh: false });

    expect(third.state.exports).toEqual({ login: { token: "t" } });
    expect(third.state.sessionStorage).toEqual({ "https://app": { a: "1" } });
  });

  it("lists a consumer's scenario-scoped and fresh acquisitions for teardown, children first, once", async () => {
    const teardown = [STEP];
    const { manager } = build([
      setup("auth-default", { teardown }),
      setup("org-exists", { from: "auth-default", scope: "scenario", teardown, exports: ["orgId"] }),
      setup("project-exists", { from: "org-exists", scope: "scenario", teardown }),
    ], { resources: { "org-exists": { orgId: 3 } } });

    await manager.acquire("project-exists", { forScenarioId: "s1", fresh: false });
    await manager.acquire("auth-default", { forScenarioId: "s2", fresh: true });

    const s1 = manager.takeConsumerTeardowns("s1");
    expect(s1.map((d) => d.setupId)).toEqual(["project-exists", "org-exists"]);
    expect(s1[1].state.exports).toEqual({ orgId: 3 });
    expect(manager.takeConsumerTeardowns("s1")).toEqual([]);
    expect(manager.takeConsumerTeardowns("s2").map((d) => d.setupId)).toEqual(["auth-default"]);
    expect(manager.ranWithTeardown().map((d) => d.setupId)).toEqual(["auth-default"]);
  });

  it("keeps a scenario-scoped parent's teardown when its child fails", async () => {
    const { manager } = build(
      [
        setup("org-exists", { scope: "scenario", teardown: [STEP] }),
        setup("project-exists", { from: "org-exists", scope: "scenario" }),
      ],
      { failures: { "project-exists": 2 } },
    );

    await expect(manager.acquire("project-exists", { forScenarioId: "s1", fresh: false })).rejects.toBeInstanceOf(
      SetupFailedError,
    );

    expect(manager.takeConsumerTeardowns("s1").map((d) => d.setupId)).toEqual(["org-exists"]);
  });

  it("throws SetupFailedError for an unknown setup", async () => {
    const { manager } = build([]);

    await expect(manager.acquire("missing", { forScenarioId: "s1", fresh: false })).rejects.toBeInstanceOf(
      SetupFailedError,
    );
  });
});
