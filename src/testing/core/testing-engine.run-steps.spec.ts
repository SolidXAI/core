// Purpose: steps of a setup, ready check or teardown report a path naming their block, and heals found in them are
// attributed to the setup, never to the consumer scenario.

import type { HealEvent, TestContext } from "../contracts/runtime-context.types";
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { SimpleResourceStore } from "./resource-store";
import { StepRegistry } from "./step-registry";
import { TestingEngine } from "./testing-engine";

function build(heals: HealEvent[] = []) {
  const ended: any[] = [];
  const registry = new StepRegistry();
  // A step that "heals": records what the real resolver would, from the context it was given.
  registry.register("test.heal", async (ctx) => {
    heals.push({
      scenarioId: ctx.healOwnerId ?? ctx.scenarioId,
      stepPath: ctx.stepPath,
      op: "test.heal",
      field: "selector",
      from: "a",
      to: "b",
      strategy: "fallback",
      policy: "report",
    });
  });
  const ui = { getHeals: () => [...heals], resetCapture: () => undefined, recordScenario: () => undefined, page: undefined } as any;
  const reporter = { onScenarioStart: () => undefined, onScenarioEnd: jest.fn(), onStepStart: () => undefined, onStepEnd: (a: any) => ended.push(a) } as any;
  const ctx = { scenarioId: "consumer", scenarioType: "ui", params: {}, resources: new SimpleResourceStore(), reporter, ui } as unknown as TestContext;
  return { engine: new TestingEngine(registry), ctx, ended, heals, reporter };
}

const steps = [{ given: { op: "test.heal" } }, { then: [{ op: "test.heal" }, { op: "test.heal" }] }] as any;

describe("TestingEngine.runSteps: step paths and heal owners", () => {
  it.each([
    ["setup", "steps"],
    ["ready", "ready"],
    ["teardown", "teardown"],
  ])("reports %s steps as %s[i]", async (label, root) => {
    const { engine, ctx, ended } = build();
    await engine.runSteps(steps, ctx, label, "consumer", "setup:s1");
    expect(ended.map((e) => e.stepPath)).toEqual([`${root}[0].given`, `${root}[1].then[0]`, `${root}[1].then[1]`]);
    expect(ended.every((e) => e.scenarioId === "consumer" && e.setup === label)).toBe(true);
  });

  it("attributes heals from ready steps to the setup, though the steps are reported under the consumer", async () => {
    const { engine, ctx, heals } = build();
    await engine.runSteps(steps, ctx, "ready", "consumer", "setup:s1");
    expect(heals.map((h) => [h.scenarioId, h.stepPath])).toEqual([
      ["setup:s1", "ready[0].given"],
      ["setup:s1", "ready[1].then[0]"],
      ["setup:s1", "ready[1].then[1]"],
    ]);
  });

  it("attributes heals from setup and teardown steps to the setup", async () => {
    const { engine, ctx, heals } = build();
    await engine.runSteps([steps[0]], ctx, "setup", "setup:s1", "setup:s1");
    await engine.runSteps([steps[0]], ctx, "teardown", "setup:s1", "setup:s1");
    expect(heals.map((h) => [h.scenarioId, h.stepPath])).toEqual([
      ["setup:s1", "steps[0].given"],
      ["setup:s1", "teardown[0].given"],
    ]);
  });

  it("leaves a scenario's own step paths and heal owner alone, and keeps setup heals out of its result", async () => {
    const { engine, ctx, heals, reporter } = build();
    // A setup heal still in the adapter's buffer when the scenario ends must not become the scenario's heal.
    await engine.runSteps([steps[0]], ctx, "ready", "consumer", "setup:s1");
    const scenario: ScenarioSpec = { id: "consumer", type: "ui", steps: [{ given: { op: "test.heal" } }] } as any;
    await engine.runScenario(scenario, ctx);
    const result = reporter.onScenarioEnd.mock.calls[0][1];
    expect(result.heals).toEqual([expect.objectContaining({ scenarioId: "consumer", stepPath: "steps[0].given" })]);
    expect(heals).toHaveLength(2);
  });
});
