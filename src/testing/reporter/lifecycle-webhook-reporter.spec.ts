import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { LifecycleWebhookReporter } from "./lifecycle-webhook-reporter";
import type { LifecycleEnvelope } from "./lifecycle-events.types";

describe("LifecycleWebhookReporter", () => {
  const scenario = (id: string): ScenarioSpec => ({ id, type: "ui", steps: [] });

  async function capture(drive: (r: LifecycleWebhookReporter) => void): Promise<LifecycleEnvelope<any>[]> {
    const sent: LifecycleEnvelope<any>[] = [];
    const reporter = new LifecycleWebhookReporter({
      webhookUrl: "http://hub.invalid/events",
      runName: "spec",
      post: async (_url, body) => {
        sent.push(body as LifecycleEnvelope<any>);
        return { ok: true, status: 200 };
      },
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
    drive(reporter);
    await reporter.flushPending(0);
    return sent;
  }

  afterEach(() => jest.restoreAllMocks());

  it("sends heals and step paths on scenario.end", async () => {
    const heal = {
      scenarioId: "a",
      stepPath: "steps[1].when",
      op: "ui.click",
      field: "selector" as const,
      from: "#old",
      to: "role=button[name=\"Save\"i]",
      strategy: "fingerprint" as const,
      policy: "report" as const,
    };
    const sent = await capture((r) => {
      r.onRunStart({ total: 1, startedAt: new Date().toISOString(), scenarioIds: ["a"] });
      r.onScenarioStart(scenario("a"));
      r.onStepEnd({ scenarioId: "a", phase: "when", step: { op: "ui.click" }, ok: true, durationMs: 5, stepPath: "steps[1].when" });
      r.onScenarioEnd(scenario("a"), { ok: true, durationMs: 9, heals: [heal] });
    });
    const end = sent.find((e) => e.event === "scenario.end")!;
    expect(end.data).toMatchObject({ status: "passed", heals: [heal], steps: [{ stepPath: "steps[1].when" }] });
  });

  it("keeps a mobile step's slowest device call on the reported step", async () => {
    const sent = await capture((r) => {
      r.onRunStart({ total: 1, startedAt: new Date().toISOString(), scenarioIds: ["a"] });
      r.onScenarioStart(scenario("a"));
      r.onStepEnd({ scenarioId: "a", phase: "when", step: { op: "mobile.tap" }, ok: true, durationMs: 31_500, slowestCallMs: 31_000 });
      r.onStepEnd({ scenarioId: "a", phase: "then", step: { op: "mobile.expectVisible" }, ok: true, durationMs: 40 });
      r.onScenarioEnd(scenario("a"), { ok: true, durationMs: 31_600 });
    });
    const end = sent.find((e) => e.event === "scenario.end")!;
    const steps = (end.data as any).steps;
    expect(steps[0]).toMatchObject({ operation: "mobile.tap", slowestCallMs: 31_000 });
    expect(steps[1]).not.toHaveProperty("slowestCallMs");
  });

  it("reports a skipped scenario as a non-passing scenario.end and counts it on run.end", async () => {
    const sent = await capture((r) => {
      r.onRunStart({ total: 2, startedAt: new Date().toISOString(), scenarioIds: ["a", "b"] });
      r.onScenarioStart(scenario("a"));
      r.onScenarioEnd(scenario("a"), { ok: false, durationMs: 3, error: new Error("boom") });
      r.onScenarioSkipped(scenario("b"), { reason: "dependency_failed", dependency: "a" });
    });
    const ends = sent.filter((e) => e.event === "scenario.end").map((e) => e.data);
    expect(ends[1]).toMatchObject({
      scenarioId: "b",
      ok: false,
      status: "skipped",
      skip: { reason: "dependency_failed", dependency: "a" },
    });
    expect(sent.find((e) => e.event === "run.end")!.data).toMatchObject({ ok: false, failed: 1, skipped: 1, total: 2 });
  });

  it("sends a blocked scenario as scenario.start then a blocked scenario.end, and counts it on run.end", async () => {
    const sent = await capture((r) => {
      r.onRunStart({ total: 2, startedAt: new Date().toISOString(), scenarioIds: ["a", "b"] });
      r.onScenarioBlocked(scenario("a"), { kind: "setup", id: "auth-default", error: "login failed" });
      r.onScenarioBlocked(scenario("b"), { kind: "gate", id: "a" });
    });
    const types = sent.map((e) => e.event);
    expect(types).toEqual(["run.start", "scenario.start", "scenario.end", "scenario.start", "scenario.end", "run.end"]);
    const ends = sent.filter((e) => e.event === "scenario.end").map((e) => e.data);
    expect(ends[0]).toMatchObject({
      scenarioId: "a",
      ok: false,
      status: "blocked",
      blockedBy: { kind: "setup", id: "auth-default", error: "login failed" },
      durationMs: 0,
      steps: [],
      artifacts: [],
    });
    expect(ends[1]).toMatchObject({ scenarioId: "b", status: "blocked", blockedBy: { kind: "gate", id: "a" } });
    expect(sent.find((e) => e.event === "run.end")!.data).toMatchObject({ ok: false, failed: 0, passed: 0, blocked: 2 });
  });

  it("sends setup.end with the setup's own steps and, on failure, its attachments", async () => {
    const sent = await capture((r) => {
      r.onRunStart({
        total: 1,
        startedAt: new Date().toISOString(),
        scenarioIds: ["a"],
        setups: [{ id: "auth-default", name: "Signed in", scope: "run" }],
        order: "shuffle",
        shuffleSeed: "seed-1",
      });
      r.onStepEnd({ scenarioId: "setup:auth-default", phase: "when", step: { op: "ui.goto" }, ok: true, durationMs: 5 });
      r.onStepEnd({ scenarioId: "setup:auth-default", phase: "when", step: { op: "ui.fill" }, ok: false, error: new Error("no field"), durationMs: 7 });
      r.attach({ scenarioId: "setup:auth-default", name: "console.log", contentType: "text/plain", data: "warn: x" });
      r.onSetupEnd({ setupId: "auth-default", attempt: 1, forScenarioId: "a", ok: false, durationMs: 12, error: "boom", reused: false });
      r.onSetupEnd({ setupId: "auth-default", attempt: 2, forScenarioId: "a", ok: true, durationMs: 9, reused: false });
      r.onSetupEnd({ setupId: "auth-default", attempt: 0, forScenarioId: "b", ok: true, durationMs: 0, reused: true });
      r.onScenarioStart(scenario("a"));
      r.onScenarioEnd(scenario("a"), { ok: true, durationMs: 3 });
    });
    const runStart = sent.find((e) => e.event === "run.start")!.data as any;
    expect(runStart).toMatchObject({ setups: [{ id: "auth-default", name: "Signed in", scope: "run" }], order: "shuffle", shuffleSeed: "seed-1" });

    const setupEnds = sent.filter((e) => e.event === "setup.end").map((e) => e.data as any);
    expect(setupEnds).toHaveLength(3);
    expect(setupEnds[0]).toMatchObject({ setupId: "auth-default", name: "Signed in", attempt: 1, ok: false, reused: false, error: "boom" });
    expect(setupEnds[0].steps.map((s: any) => s.operation)).toEqual(["ui.goto", "ui.fill"]);
    expect(setupEnds[0].artifacts).toEqual([expect.objectContaining({ kind: "console", transport: "inline" })]);
    // The second attempt starts with empty buffers: no steps or artifacts from attempt 1 leak into it.
    expect(setupEnds[1]).toMatchObject({ attempt: 2, ok: true, steps: [], artifacts: [] });
    expect(setupEnds[1]).not.toHaveProperty("error");
    expect(setupEnds[2]).toMatchObject({ reused: true, steps: [], artifacts: [] });

    // Setup steps never reach the consumer scenario's steps.
    expect((sent.find((e) => e.event === "scenario.end")!.data as any).steps).toEqual([]);
  });

  it("keeps ready-check steps in the consumer scenario and reports setup info on its scenario.end", async () => {
    const sent = await capture((r) => {
      r.onRunStart({ total: 1, startedAt: new Date().toISOString(), scenarioIds: ["a"] });
      r.onSetupEnd({ setupId: "auth-default", attempt: 1, forScenarioId: "a", ok: true, durationMs: 4100, reused: false });
      r.onScenarioSetup("a", { id: "auth-default", reused: false, durationMs: 4100, readyCheck: "retried" });
      r.onScenarioStart(scenario("a"));
      r.onStepEnd({ scenarioId: "a", phase: "given", step: { op: "ui.expectVisible" }, ok: true, durationMs: 3, setup: "ready" });
      r.onScenarioEnd(scenario("a"), { ok: true, durationMs: 9 });
      r.onScenarioStart(scenario("b"));
      r.onScenarioEnd(scenario("b"), { ok: true, durationMs: 1 });
    });
    const ends = sent.filter((e) => e.event === "scenario.end").map((e) => e.data as any);
    expect(ends[0]).toMatchObject({
      scenarioId: "a",
      setup: { id: "auth-default", reused: false, durationMs: 4100, readyCheck: "retried" },
      steps: [{ operation: "ui.expectVisible", setup: "ready" }],
    });
    expect(ends[1]).not.toHaveProperty("setup");
  });

  it("sends teardown.end and counts blocked scenarios on run.end only when there are some", async () => {
    const sent = await capture((r) => {
      r.onRunStart({ total: 1, startedAt: new Date().toISOString(), scenarioIds: ["a"] });
      r.onTeardownEnd({ setupId: "auth-default", ok: false, durationMs: 20, error: new Error("logout failed") });
      r.onScenarioStart(scenario("a"));
      r.onScenarioEnd(scenario("a"), { ok: true, durationMs: 1 });
    });
    expect(sent.find((e) => e.event === "teardown.end")!.data).toMatchObject({ setupId: "auth-default", ok: false, durationMs: 20 });
    expect(sent.find((e) => e.event === "teardown.end")!.data).toHaveProperty("error");
    expect(sent.find((e) => e.event === "run.end")!.data).not.toHaveProperty("blocked");
  });

  it("sends setup.start for each attempt and setup steps start empty on every attempt", async () => {
    const sent = await capture((r) => {
      r.onRunStart({ total: 1, startedAt: new Date().toISOString(), scenarioIds: ["a"], setups: [{ id: "s", name: "S", scope: "scenario" }] });
      r.onSetupStart({ setupId: "s", attempt: 1, forScenarioId: "a" });
      r.onStepEnd({ scenarioId: "setup:s", phase: "when", step: { op: "ui.goto" }, ok: true, durationMs: 1, setup: "setup" });
      r.onSetupEnd({ setupId: "s", attempt: 1, forScenarioId: "a", ok: true, durationMs: 1, reused: false });
      // Teardown steps share the setup owner id; they must not reach the next setup.end.
      r.onStepEnd({ scenarioId: "setup:s", phase: "when", step: { op: "api.post" }, ok: true, durationMs: 1, setup: "teardown" });
      r.onTeardownEnd({ setupId: "s", ok: true, durationMs: 1 });
      r.onStepEnd({ scenarioId: "setup:s", phase: "when", step: { op: "api.delete" }, ok: true, durationMs: 1, setup: "teardown" });
      r.onSetupStart({ setupId: "s", attempt: 1, forScenarioId: "b" });
      r.onStepEnd({ scenarioId: "setup:s", phase: "when", step: { op: "ui.fill" }, ok: true, durationMs: 1, setup: "setup" });
      r.onSetupEnd({ setupId: "s", attempt: 1, forScenarioId: "b", ok: true, durationMs: 1, reused: false });
    });
    const starts = sent.filter((e) => e.event === "setup.start").map((e) => e.data);
    expect(starts).toEqual([
      { setupId: "s", name: "S", attempt: 1, forScenarioId: "a" },
      { setupId: "s", name: "S", attempt: 1, forScenarioId: "b" },
    ]);
    const ends = sent.filter((e) => e.event === "setup.end").map((e) => e.data as any);
    expect(ends[0].steps.map((s: any) => s.operation)).toEqual(["ui.goto"]);
    expect(ends[1].steps.map((s: any) => s.operation)).toEqual(["ui.fill"]);
  });

  it("keeps ready-check steps sent before the scenario starts, also across a scenario retry", async () => {
    const sent = await capture((r) => {
      r.onRunStart({ total: 2, startedAt: new Date().toISOString(), scenarioIds: ["a", "b"] });
      r.onScenarioStart(scenario("a"));
      r.onScenarioEnd(scenario("a"), { ok: true, durationMs: 1 });
      r.onStepEnd({ scenarioId: "b", phase: "given", step: { op: "ui.expectVisible" }, ok: true, durationMs: 1, setup: "ready" });
      r.onScenarioStart(scenario("b"));
      r.onStepEnd({ scenarioId: "b", phase: "when", step: { op: "ui.click" }, ok: false, durationMs: 1 });
      r.onScenarioStart(scenario("b"));
      r.onStepEnd({ scenarioId: "b", phase: "when", step: { op: "ui.click" }, ok: true, durationMs: 1 });
      r.onScenarioEnd(scenario("b"), { ok: true, durationMs: 1 });
    });
    const ends = sent.filter((e) => e.event === "scenario.end").map((e) => e.data as any);
    expect(ends[0].steps).toEqual([]);
    expect(ends[1].steps.map((s: any) => [s.operation, s.setup])).toEqual([
      ["ui.expectVisible", "ready"],
      ["ui.click", undefined],
    ]);
  });

  it("run.end is not ok when the runner reported a failed run", async () => {
    const sent = await capture((r) => {
      r.onRunStart({ total: 1, startedAt: new Date().toISOString(), scenarioIds: ["a"] });
      r.onScenarioStart(scenario("a"));
      r.onScenarioEnd(scenario("a"), { ok: true, durationMs: 1 });
      r.onRunEnd({ ok: false, total: 1, passed: 1, failed: 0, durationMs: 1 });
    });
    expect(sent.find((e) => e.event === "run.end")!.data).toMatchObject({ ok: false });
  });
});
