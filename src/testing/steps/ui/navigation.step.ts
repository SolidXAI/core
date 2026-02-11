import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type GotoInput = { url: string };
type ExpectUrlInput = { equals?: string; contains?: string };

function requirePage(ctx: TestContext, op: string) {
  if (!ctx.ui || !ctx.ui.page) {
    throw new Error(`Missing UI page on context for op "${op}"`);
  }
  return ctx.ui.page;
}

export function registerNavigationSteps(registry: StepRegistry): void {
  registry.register("ui.goto", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.goto");
    const input = (step.with ?? {}) as GotoInput;
    if (!input.url) {
      throw new Error('Missing "url" in step.with for op "ui.goto"');
    }
    const url = ctx.ui?.resolveUrl(input.url) ?? input.url;
    await page.goto(url);
  });

  registry.register("ui.expectUrl", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.expectUrl");
    const input = (step.with ?? {}) as ExpectUrlInput;
    const current = page.url();

    if (input.equals !== undefined) {
      if (current !== input.equals) {
        throw new Error(
          `Expected URL to equal "${input.equals}" but got "${current}"`,
        );
      }
      return;
    }

    if (input.contains !== undefined) {
      if (!current.includes(input.contains)) {
        throw new Error(
          `Expected URL to contain "${input.contains}" but got "${current}"`,
        );
      }
      return;
    }

    throw new Error(
      'Missing "equals" or "contains" in step.with for op "ui.expectUrl"',
    );
  });
}
