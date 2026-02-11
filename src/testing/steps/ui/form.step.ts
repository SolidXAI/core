import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type FillInput = { selector: string; value: string };
type SelectInput = { selector: string; value: string };

function requirePage(ctx: TestContext, op: string) {
  if (!ctx.ui || !ctx.ui.page) {
    throw new Error(`Missing UI page on context for op "${op}"`);
  }
  return ctx.ui.page;
}

export function registerFormSteps(registry: StepRegistry): void {
  registry.register("ui.fill", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.fill");
    const input = (step.with ?? {}) as FillInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.fill"');
    }
    if (input.value === undefined) {
      throw new Error('Missing "value" in step.with for op "ui.fill"');
    }
    await page.fill(input.selector, String(input.value));
  });

  registry.register("ui.select", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.select");
    const input = (step.with ?? {}) as SelectInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.select"');
    }
    if (input.value === undefined) {
      throw new Error('Missing "value" in step.with for op "ui.select"');
    }
    await page.selectOption(input.selector, String(input.value));
  });
}
