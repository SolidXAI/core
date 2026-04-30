import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type VisibleInput = { selector: string };
type ExpectTextInput = { selector: string; equals?: string; contains?: string };

function requirePage(ctx: TestContext, op: string) {
  if (!ctx.ui || !ctx.ui.page) {
    throw new Error(`Missing UI page on context for op "${op}"`);
  }
  return ctx.ui.page;
}

export function registerAssertionSteps(registry: StepRegistry): void {
  registry.register("ui.expectVisible", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.expectVisible");
    const input = (step.with ?? {}) as VisibleInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.expectVisible"');
    }
    await page.waitForSelector(input.selector, { state: "visible" });
  });

  registry.register("ui.expectHidden", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.expectHidden");
    const input = (step.with ?? {}) as VisibleInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.expectHidden"');
    }
    await page.waitForSelector(input.selector, { state: "hidden" });
  });

  registry.register("ui.expectText", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.expectText");
    const input = (step.with ?? {}) as ExpectTextInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.expectText"');
    }

    const text = await page.locator(input.selector).innerText();
    if (input.equals !== undefined) {
      if (text !== input.equals) {
        throw new Error(
          `Expected text to equal "${input.equals}" but got "${text}"`,
        );
      }
      return;
    }
    if (input.contains !== undefined) {
      if (!text.includes(input.contains)) {
        throw new Error(
          `Expected text to contain "${input.contains}" but got "${text}"`,
        );
      }
      return;
    }

    throw new Error(
      'Missing "equals" or "contains" in step.with for op "ui.expectText"',
    );
  });
}
