import type { MobileAdapter } from "../../adapters/mobile/mobile-adapter";
import type { MobileElement } from "../../adapters/mobile/mobile.types";
import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { HIDE_METHODS, hideKeyboardBy, methodsFrom, reachTarget, type HideMethod } from "../../adapters/mobile/ios-keyboard";
import { KEYBOARD_STAYS_ON_PHONE } from "../../adapters/mobile/phone-errors";
import { resolveMobileTarget } from "../../adapters/mobile/resolve-mobile-target";
import { StepRegistry } from "../../core/step-registry";
import { isNotFound, OPTIONAL_SKIPPED, OPTIONAL_TIMEOUT_MS, optionalBoolean, requireLocator, requireMobile, stepTimeout } from "./shared";

/**
 * The element of a step. An optional step (`with.optional`) looks for a short time with its own locator only, and passes,
 * doing nothing, when the element is not there: a reset has to work from any state, and a "Log out" button only exists
 * when someone is logged in. An optional step never heals, because swapping in a different element could do the wrong
 * thing. Returns undefined for a skipped step.
 */
async function targetOf(ctx: TestContext, mobile: MobileAdapter, step: OpStep, op: string): Promise<MobileElement | undefined> {
  const optional = optionalBoolean(step, "optional", op) === true;
  if (!optional) {
    return mobile.findDisplayed(await resolveMobileTarget(ctx, step, stepTimeout(step)), stepTimeout(step));
  }
  try {
    return await mobile.findDisplayed(requireLocator(step, op), stepTimeout(step) ?? OPTIONAL_TIMEOUT_MS);
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

export function registerActionSteps(registry: StepRegistry): void {
  registry.register("mobile.tap", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.tap");
    requireLocator(step, "mobile.tap");
    const element = await targetOf(ctx, mobile, step, "mobile.tap");
    if (!element) return OPTIONAL_SKIPPED;
    await element.click();
  });

  registry.register("mobile.type", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.type");
    requireLocator(step, "mobile.type");
    const text = step.with?.text;
    if (typeof text !== "string" && typeof text !== "number") {
      throw new Error('Missing "text" in step.with for op "mobile.type"');
    }
    const clear = optionalBoolean(step, "clear", "mobile.type") ?? true;
    const element = await targetOf(ctx, mobile, step, "mobile.type");
    if (!element) return OPTIONAL_SKIPPED;
    if (clear) {
      await element.setValue(String(text));
    } else {
      await element.addValue(String(text));
    }
  });

  registry.register("mobile.clear", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.clear");
    requireLocator(step, "mobile.clear");
    const element = await mobile.findDisplayed(await resolveMobileTarget(ctx, step, stepTimeout(step)), stepTimeout(step));
    await element.clearValue();
  });

  registry.register("mobile.back", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.back");
    const optional = optionalBoolean(step, "optional", "mobile.back") === true;
    const driver = mobile.getDriver();
    if (mobile.ios) {
      // iOS has no system back. The driver taps the navigation bar's back button, and does nothing, successfully, when
      // there is none, which would hide a failing scenario; the root screen of an app can have a bar with no button (D35).
      const buttons = await driver.$$("-ios class chain:**/XCUIElementTypeNavigationBar/XCUIElementTypeButton");
      if (buttons.length === 0) {
        // An optional back, in a reset, has nothing to do on a screen that is already as far back as it goes.
        if (optional) return OPTIONAL_SKIPPED;
        throw new Error(
          "mobile.back: this screen has no back button on iOS. Tap the screen's own back control instead.",
        );
      }
    }
    await driver.back();
  });

  registry.register("mobile.hideKeyboard", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.hideKeyboard");
    const driver = mobile.getDriver();
    if (mobile.ios) {
      if (!mobile.phone) {
        // The Simulator reports a keyboard as shown even after it is hidden, so it cannot be asked first. The driver says
        // so when it finds no key to dismiss it with, which means there was nothing to hide.
        try {
          await driver.hideKeyboard();
        } catch (error: any) {
          if (!String(error?.message ?? error).includes("dismiss the keyboard")) throw error;
        }
        return;
      }
      // iOS has no hide-keyboard action: the keyboard goes when the app ends editing, and apps differ in what does that.
      // A phone reports its keyboard truthfully, so each way is tried and checked, and the one that worked is returned for
      // the recording to keep. A step that "passed" with the keyboard still covering the screen would only fail later, at a
      // tap that cannot reach its target (D47).
      const recorded = step.with?.method;
      if (recorded !== undefined && !HIDE_METHODS.includes(recorded as HideMethod)) {
        throw new Error(`"method" must be one of ${HIDE_METHODS.join(", ")} for op "mobile.hideKeyboard"`);
      }
      if (!(await driver.isKeyboardShown())) return { method: "none" };
      const method = await hideKeyboardBy(mobile, methodsFrom(recorded as HideMethod | undefined));
      if (!method) throw new Error(KEYBOARD_STAYS_ON_PHONE);
      return { method };
    }
    // Hiding a keyboard that is not shown is an error on some devices, so check first.
    if (await driver.isKeyboardShown()) {
      await driver.hideKeyboard();
    }
  });
}
