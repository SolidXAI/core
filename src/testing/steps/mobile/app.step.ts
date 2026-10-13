import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { optionalBoolean, requireMobile, stepTimeout } from "./shared";

export function registerAppSteps(registry: StepRegistry): void {
  registry.register("mobile.launch", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.launch");
    const clearData = optionalBoolean(step, "clearData", "mobile.launch") ?? false;
    // Only a simulator grants permissions; false leaves the permission prompt for a test of a denial (D28).
    const grantPermissions = optionalBoolean(step, "grantPermissions", "mobile.launch");
    await mobile.launch({ clearData, grantPermissions, timeoutMs: stepTimeout(step) });
  });

  registry.register("mobile.reset", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.reset");
    await mobile.launch({ clearData: true, timeoutMs: stepTimeout(step) });
  });

  registry.register("mobile.terminate", async (ctx: TestContext) => {
    await requireMobile(ctx, "mobile.terminate").terminate();
  });
}
