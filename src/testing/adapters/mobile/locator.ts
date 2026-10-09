import type { MobileLocatorBy, MobileLocatorCore } from "./mobile.types";

export const MOBILE_LOCATOR_BYS: readonly MobileLocatorBy[] = [
  "accessibilityId",
  "id",
  "text",
  "textContains",
  "description",
  "uiautomator",
  "xpath",
];

export interface ResolvedLocator {
  /** A WebdriverIO selector string. */
  selector: string;
  /** Which match to use when the selector matches several elements. */
  index?: number;
  /** Short printable form for error messages. */
  label: string;
}

const EXAMPLE = '{ "by": "accessibilityId", "value": "Login button" }';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uiSelectorString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toCore(input: Record<string, unknown>): MobileLocatorCore {
  const { by, value, index } = input;
  if (typeof by !== "string" || !MOBILE_LOCATOR_BYS.includes(by as MobileLocatorBy)) {
    throw new Error(`locator.by must be one of: ${MOBILE_LOCATOR_BYS.join(", ")}`);
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("locator.value must be a non-empty string");
  }
  if (index !== undefined && (typeof index !== "number" || !Number.isInteger(index) || index < 0)) {
    throw new Error("locator.index must be a whole number >= 0");
  }
  return { by: by as MobileLocatorBy, value, index: index as number | undefined };
}

/**
 * Turns a scenario locator into a WebdriverIO selector (D5). The `android` override, when present,
 * replaces by/value/index; `ios` is ignored on Android.
 */
export function resolveLocator(input: unknown, ctx: { appPackage: string }): ResolvedLocator {
  if (!isPlainObject(input)) {
    throw new Error(`locator must be an object like ${EXAMPLE}`);
  }
  let source: Record<string, unknown> = input;
  if (input.android !== undefined) {
    if (!isPlainObject(input.android)) {
      throw new Error(`locator.android must be an object like ${EXAMPLE}`);
    }
    source = input.android;
  }
  const { by, value, index } = toCore(source);

  let selector: string;
  switch (by) {
    case "accessibilityId":
      selector = `~${value}`;
      break;
    case "id":
      // A bare id gets the app package prefixed. Ids that already carry one (android:id/text1) are kept.
      selector = `id=${value.includes(":") ? value : `${ctx.appPackage}:id/${value}`}`;
      break;
    case "text":
      selector = `android=new UiSelector().text("${uiSelectorString(value)}")`;
      break;
    case "textContains":
      selector = `android=new UiSelector().textContains("${uiSelectorString(value)}")`;
      break;
    case "description":
      selector = `android=new UiSelector().description("${uiSelectorString(value)}")`;
      break;
    case "uiautomator":
      selector = `android=${value}`;
      break;
    case "xpath":
      selector = value;
      break;
  }

  const label = `{ by: "${by}", value: "${value}"${index !== undefined ? `, index: ${index}` : ""} }`;
  return { selector, index, label };
}
