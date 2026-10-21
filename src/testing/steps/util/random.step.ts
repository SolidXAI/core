import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { randomDataFor } from "../../core/random-data";
import { StepRegistry } from "../../core/step-registry";

type RandomInput = { generator: string; args?: Record<string, unknown> };

// Generates one value and returns it, so `saveAs` can keep it: the same email can then be typed
// in one step and asserted in another through ${res:<saveAs>}. An inline ${random:...} token
// gives a new value each time it is resolved.
export function registerRandomStep(registry: StepRegistry): void {
  registry.register("util.random", async (ctx: TestContext, step: OpStep) => {
    const input = (step.with ?? {}) as RandomInput;
    if (!input.generator) {
      throw new Error('Missing "generator" in step.with for op "util.random"');
    }
    const args = input.args ?? {};
    if (typeof args !== "object" || Array.isArray(args)) {
      throw new Error('"args" must be an object for op "util.random", e.g. { "domain": "acme.test" }');
    }
    return randomDataFor(ctx).generate(String(input.generator), args);
  });
}
