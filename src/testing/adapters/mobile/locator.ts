import type { MobileLocatorBy, MobileLocatorCore, MobilePlatform } from "./mobile.types";

export const MOBILE_LOCATOR_BYS: readonly MobileLocatorBy[] = [
  "accessibilityId",
  "id",
  "text",
  "textContains",
  "description",
  "uiautomator",
  "iosPredicate",
  "iosClassChain",
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

/** Inside an NSPredicate string literal, backslashes and double quotes are escaped the same way. */
const predicateString = uiSelectorString;

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
 * Turns a scenario locator into a WebdriverIO selector (D5, D33). The override for the running platform (`android` or
 * `ios`), when present, replaces by/value/index; the other platform's override is ignored.
 */
export function resolveLocator(
  input: unknown,
  ctx: { appPackage: string; platform?: MobilePlatform },
): ResolvedLocator {
  if (!isPlainObject(input)) {
    throw new Error(`locator must be an object like ${EXAMPLE}`);
  }
  const ios = ctx.platform === "iOS";
  const overrideKey = ios ? "ios" : "android";
  let source: Record<string, unknown> = input;
  if (input[overrideKey] !== undefined) {
    const override = input[overrideKey];
    if (!isPlainObject(override)) {
      throw new Error(`locator.${overrideKey} must be an object like ${EXAMPLE}`);
    }
    source = override;
  }
  const { by, value, index } = toCore(source);

  let selector: string;
  switch (by) {
    case "accessibilityId":
      selector = `~${value}`;
      break;
    case "id":
      // iOS has no resource ids: the accessibility identifier is the closest thing, so the same value is used.
      // On Android a bare id gets the app package prefixed; ids that already carry one (android:id/text1) are kept.
      selector = ios ? `~${value}` : `id=${value.includes(":") ? value : `${ctx.appPackage}:id/${value}`}`;
      break;
    case "text":
      selector = ios
        ? `-ios predicate string:label == "${predicateString(value)}" OR value == "${predicateString(value)}"`
        : `android=new UiSelector().text("${uiSelectorString(value)}")`;
      break;
    case "textContains":
      selector = ios
        ? `-ios predicate string:label CONTAINS "${predicateString(value)}" OR value CONTAINS "${predicateString(value)}"`
        : `android=new UiSelector().textContains("${uiSelectorString(value)}")`;
      break;
    case "description":
      selector = ios ? `~${value}` : `android=new UiSelector().description("${uiSelectorString(value)}")`;
      break;
    case "uiautomator":
      if (ios) {
        throw new Error('locator.by "uiautomator" only works on Android; on iOS use "iosPredicate" or "iosClassChain"');
      }
      selector = `android=${value}`;
      break;
    case "iosPredicate":
      if (!ios) throw new Error('locator.by "iosPredicate" only works on iOS; on Android use "uiautomator"');
      selector = `-ios predicate string:${value}`;
      break;
    case "iosClassChain":
      if (!ios) throw new Error('locator.by "iosClassChain" only works on iOS; on Android use "uiautomator"');
      selector = `-ios class chain:${value}`;
      break;
    case "xpath":
      selector = value;
      break;
  }

  const label = `{ by: "${by}", value: "${value}"${index !== undefined ? `, index: ${index}` : ""} }`;
  return { selector, index, label };
}
