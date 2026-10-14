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
    const mobile = requireMobile(ctx, "mobile.back");
    const driver = mobile.getDriver();
    if (mobile.ios) {
      // iOS has no system back. The driver taps the navigation bar's back button, and does nothing, successfully, when
      // there is none, which would hide a failing scenario; the root screen of an app can have a bar with no button (D35).
      const buttons = await driver.$$("-ios class chain:**/XCUIElementTypeNavigationBar/XCUIElementTypeButton");
      if (buttons.length === 0) {
        throw new Error(
          "mobile.back: this screen has no back button on iOS. Tap the screen's own back control instead.",
        );
      }
    }
    await driver.back();
  });

  registry.register("mobile.hideKeyboard", async (ctx: TestContext) => {
    const mobile = requireMobile(ctx, "mobile.hideKeyboard");
    const driver = mobile.getDriver();
    if (mobile.ios) {
      // The Simulator reports a keyboard as shown even after it is hidden, so it cannot be asked first. The driver says
      // so when it finds no key to dismiss it with, which means there was nothing to hide.
      try {
        await driver.hideKeyboard();
      } catch (error: any) {
        if (!String(error?.message ?? error).includes("dismiss the keyboard")) throw error;
      }
      return;
    }
    // Hiding a keyboard that is not shown is an error on some devices, so check first.
    if (await driver.isKeyboardShown()) {
      await driver.hideKeyboard();
    }
  });
}
