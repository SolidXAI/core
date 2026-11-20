import type { Locator } from "playwright";

import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { resolveTarget, type TargetInput } from "../../adapters/ui/resolve-target";

type AriaSnapshotInput = Partial<TargetInput> & {
  /** Aria snapshot template (YAML), matched the way Playwright's toMatchAriaSnapshot matches. */
  snapshot: string;
};

const POLL_INTERVAL_MS = 250;

type AriaExpectResult = {
  matches: boolean;
  received?: { raw?: string; value?: { raw?: string } };
  log?: string[];
};

/**
 * `playwright` (unlike `@playwright/test`) has no public aria matcher, but its Locator
 * carries the same `to.match.aria` expectation the test runner calls. Verified on
 * Playwright 1.59–1.62; {@link matchByLines} covers a release that drops it.
 */
async function matchWithPlaywright(
  locator: Locator,
  snapshot: string,
  timeout: number,
): Promise<{ ok: boolean; received?: string } | undefined> {
  const expectFn = (locator as any)._expect;
  if (typeof expectFn !== "function") return undefined;
  const result: AriaExpectResult = await expectFn.call(locator, "to.match.aria", {
    expectedValue: snapshot,
    isNot: false,
    timeout,
  });
  const received = result.received?.value?.raw ?? result.received?.raw;
  return { ok: !!result.matches, received };
}

function templateLines(snapshot: string): string[] {
  return snapshot
    .split("\n")
    .map((line) => line.trim().replace(/^-\s*/, "").replace(/:$/, ""))
    .filter(Boolean);
}

/** Approximate fallback: every template line must appear, in order, in the snapshot. */
async function matchByLines(
  locator: Locator,
  snapshot: string,
  timeout: number,
): Promise<{ ok: boolean; received?: string }> {
  const wanted = templateLines(snapshot);
  const deadline = Date.now() + timeout;
  let received: string | undefined;
  for (;;) {
    received = await locator.ariaSnapshot({ timeout: Math.max(1, deadline - Date.now()) }).catch(() => undefined);
    if (received !== undefined) {
      const lines = received.split("\n").map((l) => l.trim());
      let cursor = 0;
      const ok = wanted.every((w) => {
        const at = lines.findIndex((l, i) => i >= cursor && l.includes(w));
        if (at === -1) return false;
        cursor = at + 1;
        return true;
      });
      if (ok) return { ok: true, received };
    }
    if (Date.now() >= deadline) return { ok: false, received };
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export function registerAriaSnapshotSteps(registry: StepRegistry): void {
  registry.register("ui.expectAriaSnapshot", async (ctx: TestContext, step: OpStep) => {
    if (!ctx.ui || !ctx.ui.page) {
      throw new Error('Missing UI page on context for op "ui.expectAriaSnapshot"');
    }
    const page = ctx.ui.page;
    const input = (step.with ?? {}) as AriaSnapshotInput;
    if (typeof input.snapshot !== "string" || !input.snapshot.trim()) {
      throw new Error('Missing "snapshot" in step.with for op "ui.expectAriaSnapshot"');
    }
    const selector = input.selector
      ? await resolveTarget(ctx, step, input as TargetInput)
      : "body";
    const locator = page.locator(selector);
    const timeout = ctx.ui.resolveTimeout(input.timeoutMs);

    const outcome =
      (await matchWithPlaywright(locator, input.snapshot, timeout)) ??
      (await matchByLines(locator, input.snapshot, timeout));
    if (!outcome.ok) {
      throw new Error(
        `Aria snapshot of "${selector}" did not match.\nExpected:\n${input.snapshot}\nReceived:\n${outcome.received ?? "<element not found>"}`,
      );
    }
  });
}
