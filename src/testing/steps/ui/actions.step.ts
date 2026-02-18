import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type ClickInput = { selector: string };
type PressInput = { selector: string; key: string };

function requirePage(ctx: TestContext, op: string) {
  if (!ctx.ui || !ctx.ui.page) {
    throw new Error(`Missing UI page on context for op "${op}"`);
  }
  return ctx.ui.page;
}

export function registerActionSteps(registry: StepRegistry): void {
  registry.register("ui.click", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.click");
    const input = (step.with ?? {}) as ClickInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.click"');
    }
    await page.click(input.selector);
  });

  registry.register("ui.press", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.press");
    const input = (step.with ?? {}) as PressInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.press"');
    }
    if (!input.key) {
      throw new Error('Missing "key" in step.with for op "ui.press"');
    }
    await page.press(input.selector, input.key);
  });
}
