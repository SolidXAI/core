import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { optionalBoolean, requireLocator, requireMobile, stepTimeout } from "./shared";

export function registerActionSteps(registry: StepRegistry): void {
  registry.register("mobile.tap", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.tap");
    const element = await mobile.findDisplayed(requireLocator(step, "mobile.tap"), stepTimeout(step));
    await element.click();
  });

  registry.register("mobile.type", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.type");
    const locator = requireLocator(step, "mobile.type");
    const text = step.with?.text;
    if (typeof text !== "string" && typeof text !== "number") {
      throw new Error('Missing "text" in step.with for op "mobile.type"');
    }
    const clear = optionalBoolean(step, "clear", "mobile.type") ?? true;
    const element = await mobile.findDisplayed(locator, stepTimeout(step));
    if (clear) {
      await element.setValue(String(text));
    } else {
      await element.addValue(String(text));
    }
  });

  registry.register("mobile.clear", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.clear");
    const element = await mobile.findDisplayed(requireLocator(step, "mobile.clear"), stepTimeout(step));
    await element.clearValue();
  });

  registry.register("mobile.back", async (ctx: TestContext) => {
    await requireMobile(ctx, "mobile.back").getDriver().back();
  });

  registry.register("mobile.hideKeyboard", async (ctx: TestContext) => {
    const driver = requireMobile(ctx, "mobile.hideKeyboard").getDriver();
    // Hiding a keyboard that is not shown is an error on some devices, so check first.
    if (await driver.isKeyboardShown()) {
      await driver.hideKeyboard();
    }
  });
}
