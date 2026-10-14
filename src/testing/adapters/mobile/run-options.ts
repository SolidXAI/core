import type { MobileAdapterOptions, MobileRunOptionsInput } from "./mobile.types";

/**
 * Builds adapter options from the `mobile` block of a run request. Only known fields are copied, so a
 * request cannot smuggle in anything else (such as the test-only driver factory).
 */
export function toMobileAdapterOptions(
  input: MobileRunOptionsInput,
  run: { recordVideo?: boolean; capture?: { console?: boolean; screenshotOnFailure?: boolean } } = {},
): MobileAdapterOptions {
  if (input.platformName !== undefined && input.platformName !== "Android" && input.platformName !== "iOS") {
    throw new Error(`platformName must be "Android" or "iOS", got "${String(input.platformName)}"`);
  }
  return {
    appiumUrl: input.appiumUrl,
    udid: input.udid,
    platformName: input.platformName,
    simulator: input.simulator,
    appSource: input.appSource,
    appPath: input.appPath,
    appPackage: input.appPackage,
    appActivity: input.appActivity,
    appProcessName: input.appProcessName,
    wdaDerivedDataPath: input.wdaDerivedDataPath,
    wdaPrebuilt: input.wdaPrebuilt,
    defaultTimeoutMs: input.defaultTimeoutMs,
    navigationTimeoutMs: input.navigationTimeoutMs,
    strictLocators: input.strictLocators,
    extraCapabilities: input.extraCapabilities,
    recordVideo: run.recordVideo ?? true,
    capture: { console: run.capture?.console ?? true, screenshot: run.capture?.screenshotOnFailure ?? false },
  };
}
