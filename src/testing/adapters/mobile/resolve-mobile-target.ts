import type { HealEvent, TestContext } from "../../contracts/runtime-context.types";
import type { MobileFingerprint, OpStep } from "../../contracts/testing-metadata.types";
import { PRIMARY_GRACE_MS } from "../ui/resolve-target";
import type { MobileLocatorCore } from "./mobile.types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The `{ by, value, index? }` part of a locator object, or nothing when it is not shaped like one. */
function coreOf(source: unknown): MobileLocatorCore | undefined {
  if (!isObject(source) || typeof source.by !== "string" || typeof source.value !== "string") return undefined;
  return {
    by: source.by as MobileLocatorCore["by"],
    value: source.value,
    ...(typeof source.index === "number" ? { index: source.index } : {}),
  };
}

const keyOf = (core: MobileLocatorCore) => `${core.by}\u0000${core.value}\u0000${core.index ?? ""}`;

/**
 * Locators for a fingerprint, most specific first. They are plain `{ by, value }` locators so a heal can be written straight
 * back into a scenario. `kind` and `within` cannot narrow a locator today, so they are not used to find the element.
 */
export function fingerprintLocators(fp: MobileFingerprint): MobileLocatorCore[] {
  const out: MobileLocatorCore[] = [];
  if (fp.accessibilityId) out.push({ by: "accessibilityId", value: fp.accessibilityId });
  if (fp.resourceId) out.push({ by: "id", value: fp.resourceId });
  if (fp.text) out.push({ by: "text", value: fp.text });
  if (fp.label) out.push({ by: "description", value: fp.label });
  return out;
}

/**
 * The locator a step should act on. Returns the step's own locator when healing is off, when the step has no alternatives,
 * or when the locator matches within a short grace period. Otherwise the first fallback or fingerprint locator that matches
 * exactly one displayed element wins, and the heal is recorded on the adapter. With nothing better the step's own locator
 * comes back, so the step fails with its normal error. The caller has already checked that the step has a locator.
 */
export async function resolveMobileTarget(ctx: TestContext, step: OpStep, timeoutMs?: number): Promise<unknown> {
  const primary = step.with?.locator;
  const mobile = ctx.mobile;
  if (!mobile || !isObject(primary)) return primary;

  const policy = mobile.getHealingPolicy();
  if (policy === "off") return primary;

  // The locator that applies on this platform: the platform's override when there is one, else the base locator.
  const platformKey = mobile.ios ? "ios" : "android";
  const overridden = isObject(primary[platformKey]);
  const effective = coreOf(overridden ? primary[platformKey] : primary);
  if (!effective) return primary;

  const fallbacks = Array.isArray(step.with?.fallbacks) ? step.with!.fallbacks : [];
  const fromFingerprint = isObject(step.with?.fingerprint) ? fingerprintLocators(step.with!.fingerprint as MobileFingerprint) : [];
  const candidates: Array<{ core: MobileLocatorCore; strategy: HealEvent["strategy"] }> = [];
  const seen = new Set([keyOf(effective)]);
  const add = (core: MobileLocatorCore | undefined, strategy: HealEvent["strategy"]) => {
    if (!core || seen.has(keyOf(core))) return;
    seen.add(keyOf(core));
    candidates.push({ core, strategy });
  };
  for (const fallback of fallbacks) {
    // A fallback may carry its own platform override; the one for this platform is what would run.
    add(coreOf(isObject(fallback) && isObject(fallback[platformKey]) ? fallback[platformKey] : fallback), "fallback");
  }
  for (const core of fromFingerprint) add(core, "fingerprint");
  if (candidates.length === 0) return primary;

  const grace = Math.min(PRIMARY_GRACE_MS, mobile.resolveTimeout(timeoutMs));
  if (await mobile.isPresent(primary, grace)) return primary;

  for (const { core, strategy } of candidates) {
    let shown: number;
    try {
      shown = await mobile.countDisplayed(core);
    } catch {
      // A locator this platform cannot use, or a device that did not answer: it just never wins.
      continue;
    }
    if (shown !== 1) continue;
    // A slow screen can show the primary just after the grace period; prefer it then.
    if (await mobile.isPresent(primary, 0)) return primary;

    const field: HealEvent["field"] = overridden ? (`locator.${platformKey}` as const) : "locator";
    mobile.recordHeal({
      scenarioId: ctx.scenarioId,
      stepPath: ctx.stepPath,
      op: step.op,
      stepName: step.name,
      field,
      from: { ...effective },
      to: { ...core },
      strategy,
      policy,
    });
    // The healed locator keeps the other platform's override, as the file will after the heal is applied.
    if (overridden) return { ...primary, [platformKey]: core };
    const { by: _by, value: _value, index: _index, ...rest } = primary;
    return { ...core, ...rest };
  }
  return primary;
}
