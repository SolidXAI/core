import type { Locator, Page } from "playwright";

import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep, TargetFingerprint } from "../../contracts/testing-metadata.types";

/**
 * How long the primary selector gets to attach before alternatives are tried. Short on
 * purpose: alternatives only run when they exist, and the action that follows still
 * waits its full timeout on whichever selector wins.
 */
export const PRIMARY_GRACE_MS = 2_500;

export interface TargetInput {
  selector?: string;
  /** Alternative selectors, tried in order when the primary does not attach. */
  fallbacks?: string[];
  /** Element identity used when every selector misses. */
  fingerprint?: TargetFingerprint;
  timeoutMs?: number;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

/**
 * Selector strings for a fingerprint, most specific first. They are plain selector
 * strings (not Locator objects) so a heal can be written straight back into a scenario.
 */
export function fingerprintSelectors(fp: TargetFingerprint): string[] {
  const out: string[] = [];
  const scope = fp.within ? `${fp.within} >> ` : "";
  if (fp.testId) out.push(`${scope}[data-testid=${quote(fp.testId)}]`);
  if (fp.role && fp.name) out.push(`${scope}role=${fp.role}[name=${quote(fp.name)}i]`);
  if (fp.label) out.push(`${scope}internal:label=${quote(fp.label)}i`);
  if (fp.placeholder) out.push(`${scope}[placeholder=${quote(fp.placeholder)}]`);
  if (fp.role && !fp.name && fp.text) out.push(`${scope}role=${fp.role} >> text=${quote(fp.text)}`);
  if (!fp.role && fp.text) out.push(`${scope}text=${quote(fp.text)}`);
  return out;
}

async function attached(page: Page, selector: string, timeoutMs: number): Promise<boolean> {
  const locator = page.locator(selector).first();
  try {
    if (timeoutMs > 0) {
      await locator.waitFor({ state: "attached", timeout: timeoutMs });
      return true;
    }
    return (await page.locator(selector).count()) > 0;
  } catch {
    return false;
  }
}

/** An alternative is only trusted when it identifies exactly one visible element. */
async function uniqueVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const locator: Locator = page.locator(selector);
    if ((await locator.count()) !== 1) return false;
    return await locator.isVisible();
  } catch {
    // An unparsable alternative must not break the step; it just never wins.
    return false;
  }
}

/**
 * Pick the selector a UI step should act on. Returns the primary unchanged when healing
 * is off, when the step has no alternatives, or when the primary attaches. Otherwise the
 * first alternative that matches one visible element wins and a heal is recorded on the
 * adapter. With nothing better, the primary is returned so the step fails with its
 * normal error.
 */
export async function resolveTarget(
  ctx: TestContext,
  step: OpStep,
  input: TargetInput,
): Promise<string> {
  const primary = input.selector;
  if (!primary) {
    throw new Error(`Missing "selector" in step.with for op "${step.op}"`);
  }
  const ui = ctx.ui;
  const page = ui?.page;
  if (!ui || !page) return primary;

  const policy = ui.getHealingPolicy();
  const fallbacks = Array.isArray(input.fallbacks)
    ? input.fallbacks.filter((s): s is string => typeof s === "string" && s.length > 0 && s !== primary)
    : [];
  const fromFingerprint = input.fingerprint ? fingerprintSelectors(input.fingerprint) : [];
  if (policy === "off" || (fallbacks.length === 0 && fromFingerprint.length === 0)) {
    return primary;
  }

  const grace = Math.min(PRIMARY_GRACE_MS, ui.resolveTimeout(input.timeoutMs));
  if (await attached(page, primary, grace)) return primary;

  const candidates: Array<{ selector: string; strategy: "fallback" | "fingerprint" }> = [
    ...fallbacks.map((selector) => ({ selector, strategy: "fallback" as const })),
    ...fromFingerprint.map((selector) => ({ selector, strategy: "fingerprint" as const })),
  ];
  for (const candidate of candidates) {
    if (!(await uniqueVisible(page, candidate.selector))) continue;
    // A slow page can attach the primary just after the grace window; prefer it then.
    if (await attached(page, primary, 0)) return primary;
    ui.recordHeal({
      scenarioId: ctx.scenarioId,
      stepPath: ctx.stepPath,
      op: step.op,
      stepName: step.name,
      field: "selector",
      from: primary,
      to: candidate.selector,
      strategy: candidate.strategy,
      policy,
    });
    return candidate.selector;
  }
  return primary;
}
