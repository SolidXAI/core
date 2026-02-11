import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type LogInput = { message: string; data?: unknown };

export function registerLogStep(registry: StepRegistry): void {
  registry.register("util.log", async (_ctx: TestContext, step: OpStep) => {
    const input = (step.with ?? {}) as LogInput;
    if (!input.message) {
      throw new Error('Missing "message" in step.with for op "util.log"');
    }
    if (input.data !== undefined) {
      console.log(input.message, input.data);
    } else {
      console.log(input.message);
    }
  });
}
