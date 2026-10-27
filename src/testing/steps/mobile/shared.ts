import type { MobileAdapter } from "../../adapters/mobile/mobile-adapter";
import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";

export function requireMobile(ctx: TestContext, op: string): MobileAdapter {
  if (!ctx.mobile || !ctx.mobile.isStarted()) {
    throw new Error(`Missing mobile session on context for op "${op}"`);
  }
  return ctx.mobile;
}

export function requireLocator(step: OpStep, op: string): unknown {
  const locator = step.with?.locator;
  if (locator === undefined || locator === null) {
    throw new Error(`Missing "locator" in step.with for op "${op}"`);
  }
  return locator;
}

/** A step's own timeout: `with.timeoutMs` like the UI steps, else the step-level `timeoutMs`. */
export function stepTimeout(step: OpStep): number | undefined {
  const value = step.with?.timeoutMs ?? step.timeoutMs;
  return typeof value === "number" ? value : undefined;
}

export function optionalBoolean(step: OpStep, key: string, op: string): boolean | undefined {
  const value = step.with?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`"${key}" must be true or false for op "${op}"`);
  }
  return value;
}

/** How long an optional step looks for its element before it counts as not there. */
export const OPTIONAL_TIMEOUT_MS = 3000;

/** The step's element is missing or never shown, as opposed to the device not answering or a bad locator. */
export function isNotFound(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  return message.includes("No element matches") || message.includes("is not displayed after");
}

/** What an optional step returns when its element was not there. */
export const OPTIONAL_SKIPPED = { skipped: "optional-not-found" } as const;
