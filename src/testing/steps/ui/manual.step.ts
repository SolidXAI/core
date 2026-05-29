import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type WaitForManualInput = {
  message?: string;
  prompt?: string;
  waitForSelector?: string;
  waitForUrlContains?: string;
  waitForUrlEquals?: string;
  timeoutMs?: number;
  bringToFront?: boolean;
};

function requirePage(ctx: TestContext, op: string) {
  if (!ctx.ui || !ctx.ui.page) {
    throw new Error(`Missing UI page on context for op "${op}"`);
  }
  return ctx.ui.page;
}

export function registerManualSteps(registry: StepRegistry): void {
  registry.register("ui.waitForManual", async (ctx: TestContext, step: OpStep) => {
    const page = requirePage(ctx, "ui.waitForManual");
    const inputConfig = (step.with ?? {}) as WaitForManualInput;
    const message = inputConfig.message?.trim() || "Manual interaction required.";
    const prompt = inputConfig.prompt?.trim() || "Press Enter to continue...";
    const timeoutMs = inputConfig.timeoutMs;
    const bringToFront = inputConfig.bringToFront ?? true;

    if (ctx.ui?.isHeadless()) {
      throw new Error('Op "ui.waitForManual" requires headed mode. Re-run with --headless false.');
    }
    if (!input.isTTY || !output.isTTY) {
      throw new Error('Op "ui.waitForManual" requires an interactive terminal (TTY).');
    }

    if (bringToFront) {
      await page.bringToFront();
    }

    console.log("");
    console.log("════════ Manual Interaction Required ════════");
    console.log(message);
    console.log(`Scenario: ${ctx.scenarioId}`);
    console.log(`Current URL: ${page.url()}`);
    console.log(prompt);

    const rl = createInterface({ input, output });
    try {
      await rl.question("");
    } finally {
      rl.close();
    }

    if (inputConfig.waitForSelector) {
      await page.waitForSelector(inputConfig.waitForSelector, {
        state: "visible",
        timeout: timeoutMs,
      });
    }

    if (inputConfig.waitForUrlEquals) {
      await page.waitForURL(
        (url) => url.toString() === inputConfig.waitForUrlEquals,
        { timeout: timeoutMs },
      );
    }

    if (inputConfig.waitForUrlContains) {
      await page.waitForURL(
        (url) => url.toString().includes(String(inputConfig.waitForUrlContains)),
        { timeout: timeoutMs },
      );
    }
  });
}
