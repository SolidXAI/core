import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type ClickInput = { selector: string; timeoutMs?: number; optional?: boolean; force?: boolean; js?: boolean };
type PressInput = { selector: string; key: string; timeoutMs?: number };
type TypeInput = { selector: string; value: string; delayMs?: number; clear?: boolean; timeoutMs?: number };

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
    // `optional: true` lets a step dismiss a maybe-present element (e.g. an
    // intermittent popup): if the element never appears/clicks in time, swallow
    // the error instead of failing the scenario.
    try {
      // `js: true` invokes the element's native .click() in page context — the last
      // resort for a button a real click can't reach (e.g. a fixed drawer rendered
      // outside the viewport in headless). Waits for it to be attached first.
      if (input.js) {
        const loc = page.locator(input.selector).first();
        await loc.waitFor({ state: "attached", timeout: ctx.ui?.resolveTimeout(input.timeoutMs) });
        await loc.evaluate((el: any) => el.click());
      } else if (input.force) {
        // `force: true` bypasses actionability checks (e.g. an overlay intercepting
        // pointer events on a drawer/sheet button). Playwright's force still refuses
        // to click an element outside the viewport, so scroll it into view first.
        const loc = page.locator(input.selector).first();
        await loc.scrollIntoViewIfNeeded({ timeout: ctx.ui?.resolveTimeout(input.timeoutMs) });
        await loc.click({ timeout: ctx.ui?.resolveTimeout(input.timeoutMs), force: true });
      } else {
        await page.click(input.selector, {
          timeout: ctx.ui?.resolveTimeout(input.timeoutMs),
        });
      }
    } catch (err) {
      if (!input.optional) throw err;
    }
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
    await page.press(input.selector, input.key, {
      timeout: ctx.ui?.resolveTimeout(input.timeoutMs),
    });
  });

  // Type a value character-by-character with real keystrokes (keydown/input/keyup
  // per char), unlike ui.fill which sets the value in one shot. Needed for inputs
  // whose framework validation only re-runs on genuine keystroke events. `clear`
  // (default true) empties the field first.
  registry.register("ui.type", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.type");
    const input = (step.with ?? {}) as TypeInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.type"');
    }
    if (input.value === undefined || input.value === null) {
      throw new Error('Missing "value" in step.with for op "ui.type"');
    }
    const timeout = ctx.ui?.resolveTimeout(input.timeoutMs);
    const locator = page.locator(input.selector);
    if (input.clear !== false) {
      await locator.fill("", { timeout });
    }
    await locator.pressSequentially(String(input.value), {
      delay: input.delayMs ?? 30,
      timeout,
    });
  });
}
