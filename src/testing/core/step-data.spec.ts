// Purpose: a run's results show the data its steps made up or pulled out — `${random:...}` tokens, `util.random`
// values and `match` extractions — on the step that used them, and never a secret.

import type { TestContext } from "../contracts/runtime-context.types";
import { RandomDataRegistry } from "./random-data";
import { SimpleResourceStore } from "./resource-store";
import { StepRegistry } from "./step-registry";
import { TestingEngine } from "./testing-engine";
import { registerUtilSteps } from "../steps/util";

function setup() {
  const ended: any[] = [];
  const registry = new StepRegistry();
  registerUtilSteps(registry);
  registry.register("test.echo", async (_ctx, step) => step.with);
  const ctx = {
    scenarioId: "spec",
    scenarioType: "api",
    params: {},
    resources: new SimpleResourceStore(),
    randomData: new RandomDataRegistry(),
    secrets: { "app-otp-line": "Your code is 482913" },
    reporter: { onStepStart: () => undefined, onStepEnd: (args: any) => ended.push(args) } as any,
  } as TestContext;
  return { engine: new TestingEngine(registry), ctx, ended };
}

describe("data used by a step", () => {
  it("reports a util.random value with its saveAs name", async () => {
    const { engine, ctx, ended } = setup();

    const value = await engine.runStep("given" as any, { op: "util.random", with: { generator: "emailAddress" }, saveAs: "email" } as any, ctx);

    expect(ended[0].data).toEqual([{ kind: "random", source: "random:emailAddress", value, saveAs: "email" }]);
  });

  it("reports inline random tokens and match transforms, on the step that resolved them only", async () => {
    const { engine, ctx, ended } = setup();
    ctx.resources.set("sms", "OTP 7731 is valid for 5 minutes");

    const out: any = await engine.runStep("when" as any, { op: "test.echo", with: { name: "${random:firstName}", otp: "${res:sms | match:(\\d+)}" } } as any, ctx);
    await engine.runStep("then" as any, { op: "test.echo", with: { plain: "${res:sms}" } } as any, ctx);

    expect(ended[0].data).toEqual([
      { kind: "random", source: "${random:firstName}", value: out.name },
      { kind: "match", source: "${res:sms | match:(\\d+)}", value: "7731" },
    ]);
    expect(ended[1].data).toBeUndefined();
  });

  it("never reports a value taken from a secret", async () => {
    const { engine, ctx, ended } = setup();

    const out: any = await engine.runStep("when" as any, { op: "test.echo", with: { otp: "${secret:app-otp-line | match:(\\d+)}" } } as any, ctx);

    expect(out.otp).toBe("482913");
    expect(ended[0].data).toBeUndefined();
  });
});
