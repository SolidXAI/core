import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { resolveMobileTarget } from "../../adapters/mobile/resolve-mobile-target";
import { StepRegistry } from "../../core/step-registry";
import { requireLocator, requireMobile, stepTimeout } from "./shared";

export function registerAssertionSteps(registry: StepRegistry): void {
  registry.register("mobile.expectVisible", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.expectVisible");
    requireLocator(step, "mobile.expectVisible");
    await mobile.findDisplayed(await resolveMobileTarget(ctx, step, stepTimeout(step)), stepTimeout(step));
  });

  registry.register("mobile.expectHidden", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.expectHidden");
    await mobile.waitHidden(requireLocator(step, "mobile.expectHidden"), stepTimeout(step));
  });

  registry.register("mobile.getText", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.getText");
    requireLocator(step, "mobile.getText");
    const element = await mobile.findDisplayed(await resolveMobileTarget(ctx, step, stepTimeout(step)), stepTimeout(step));
    return element.getText();
  });

  registry.register("mobile.expectText", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.expectText");
    requireLocator(step, "mobile.expectText");
    const { equals, contains, matches } = step.with ?? {};
    const given = [equals, contains, matches].filter((value) => value !== undefined);
    if (given.length !== 1) {
      throw new Error('mobile.expectText needs exactly one of "equals", "contains", "matches"');
    }
    let pattern: RegExp | undefined;
    if (matches !== undefined) {
      try {
        pattern = new RegExp(String(matches));
      } catch (error: any) {
        throw new Error(`"matches" is not a valid regular expression: ${error.message}`);
      }
    }

    const locator = await resolveMobileTarget(ctx, step, stepTimeout(step));
    const element = await mobile.findDisplayed(locator, stepTimeout(step));
    const actual = await element.getText();
    const label = mobile.describeLocator(locator);

    if (equals !== undefined && actual !== String(equals)) {
      throw new Error(`Expected text of ${label} to equal "${equals}", got "${actual}"`);
    }
    if (contains !== undefined && !actual.includes(String(contains))) {
      throw new Error(`Expected text of ${label} to contain "${contains}", got "${actual}"`);
    }
    if (pattern && !pattern.test(actual)) {
      throw new Error(`Expected text of ${label} to match "${matches}", got "${actual}"`);
    }
    return actual;
  });
}
