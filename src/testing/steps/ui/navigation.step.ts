import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type GotoInput = { url: string; timeoutMs?: number };
type ExpectUrlInput = { equals?: string; contains?: string; timeoutMs?: number };
type NewTabInput = { url?: string; timeoutMs?: number };
type SwitchTabInput = { index: number };
type StoreTextInput = { selector: string; match?: string; timeoutMs?: number; readValue?: boolean };

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

  // Open a new tab (optionally navigating it) and make it the active page. The
  // previous tab stays alive on the context, so a long-running SPA flow is not
  // destroyed while we visit another site (e.g. to read an OTP).
  registry.register("ui.newTab", async (ctx: TestContext, step: OpStep) => {
    if (!ctx.ui) throw new Error('Missing UI adapter on context for op "ui.newTab"');
    const input = (step.with ?? {}) as NewTabInput;
    await ctx.ui.openTab(input.url, input.timeoutMs);
  });

  // Switch the active tab. `index` 0 is the first/original (onboarding) tab.
  registry.register("ui.switchTab", async (ctx: TestContext, step: OpStep) => {
    if (!ctx.ui) throw new Error('Missing UI adapter on context for op "ui.switchTab"');
    const input = (step.with ?? {}) as SwitchTabInput;
    if (input.index === undefined || input.index === null) {
      throw new Error('Missing "index" in step.with for op "ui.switchTab"');
    }
    ctx.ui.switchTab(Number(input.index));
  });

  // Close the active tab and make the first remaining tab active. Never closes
  // the last tab. Use after reading data from a secondary tab (e.g. the OTP portal).
  registry.register("ui.closeTab", async (ctx: TestContext) => {
    if (!ctx.ui) throw new Error('Missing UI adapter on context for op "ui.closeTab"');
    await ctx.ui.closeTab();
  });

  // Read a selector's visible text and RETURN it, so `saveAs` can capture it into
  // ${res:...}. With `match`, returns capture group 1 (else the whole match) of the
  // regex applied to the text — e.g. pull a 4-digit OTP out of an SMS row.
  registry.register("ui.storeText", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.storeText");
    const input = (step.with ?? {}) as StoreTextInput;
    if (!input.selector) {
      throw new Error('Missing "selector" in step.with for op "ui.storeText"');
    }
    // `readValue: true` reads an <input>/<textarea>/<select> current value via
    // inputValue() instead of innerText() — innerText is empty for form controls.
    const loc = page.locator(input.selector).first();
    const text = input.readValue
      ? await loc.inputValue({ timeout: ctx.ui?.resolveTimeout(input.timeoutMs) })
      : await loc.innerText({ timeout: ctx.ui?.resolveTimeout(input.timeoutMs) });
    if (input.match) {
      const m = text.match(new RegExp(input.match));
      if (!m) {
        throw new Error(
          `ui.storeText: regex "${input.match}" found no match in text "${text.slice(0, 120)}"`,
        );
      }
      return m[1] !== undefined ? m[1] : m[0];
    }
    return text;
  });
}
