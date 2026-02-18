import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type SleepInput = { ms: number };

export function registerSleepStep(registry: StepRegistry): void {
  registry.register("util.sleep", async (_ctx: TestContext, step: OpStep) => {
    const input = (step.with ?? {}) as SleepInput;
    if (input.ms === undefined) {
      throw new Error('Missing "ms" in step.with for op "util.sleep"');
    }
    await new Promise((resolve) => setTimeout(resolve, input.ms));
  });
}
