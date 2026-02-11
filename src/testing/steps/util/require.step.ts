import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

export function registerRequireStep(registry: StepRegistry): void {
  registry.register("util.require", async (ctx: TestContext, step: OpStep) => {
    const input = (step.with ?? {}) as { resource?: string; message?: string };
    if (!input.resource) {
      throw new Error('Missing "resource" in step.with for op "util.require"');
    }
    if (!ctx.resources.has(input.resource)) {
      const suffix = input.message ? ` ${input.message}` : "";
      throw new Error(`Missing required resource: "${input.resource}".${suffix}`);
    }
  });
}
