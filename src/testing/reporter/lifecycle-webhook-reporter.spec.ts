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
});
