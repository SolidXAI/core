import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { resolveNow } from "../../core/dates";
import { StepRegistry } from "../../core/step-registry";

type NowInput = { kind?: string; args?: Record<string, unknown> };

// Returns the current date or time so `saveAs` can keep it: two inline ${now:...} tokens can differ
// by a second, so a timestamp that is typed and then asserted should be taken once.
export function registerNowStep(registry: StepRegistry): void {
  registry.register("util.now", async (_ctx: TestContext, step: OpStep) => {
    const input = (step.with ?? {}) as NowInput;
    const args = input.args ?? {};
    if (typeof args !== "object" || Array.isArray(args)) {
      throw new Error('"args" must be an object for op "util.now", e.g. { "offset": "+7d" }');
    }
    return resolveNow(String(input.kind ?? "date"), args);
  });
}
