import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type GotoInput = { url: string; timeoutMs?: number };
type ExpectUrlInput = { equals?: string; contains?: string; timeoutMs?: number };

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
    await page.goto(url, {
      timeout: ctx.ui?.resolveNavigationTimeout(input.timeoutMs),
    });
  });

  registry.register("ui.expectUrl", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.expectUrl");
    const input = (step.with ?? {}) as ExpectUrlInput;

    if (input.equals === undefined && input.contains === undefined) {
      throw new Error(
        'Missing "equals" or "contains" in step.with for op "ui.expectUrl"',
      );
    }

    const expectation =
      input.equals !== undefined
        ? `equal "${input.equals}"`
        : `contain "${input.contains}"`;

    // Waits for the URL rather than sampling it, so an assertion placed straight
    // after a click does not race the navigation.
    try {
      await page.waitForURL(
        (url) =>
          input.equals !== undefined
            ? url.toString() === input.equals
            : url.toString().includes(String(input.contains)),
        { timeout: ctx.ui?.resolveNavigationTimeout(input.timeoutMs) },
      );
    } catch {
      throw new Error(
        `Expected URL to ${expectation} but got "${page.url()}"`,
      );
    }
  });
}
