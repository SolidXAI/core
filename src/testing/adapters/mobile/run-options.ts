import type { MobileAdapterOptions, MobileRunOptionsInput } from "./mobile.types";

/**
 * Builds adapter options from the `mobile` block of a run request. Only known fields are copied, so a
 * request cannot smuggle in anything else (such as the test-only driver factory).
 */
export function toMobileAdapterOptions(
  input: MobileRunOptionsInput,
  run: { recordVideo?: boolean; capture?: { console?: boolean } } = {},
): MobileAdapterOptions {
  return {
    appiumUrl: input.appiumUrl,
    udid: input.udid,
    platformName: input.platformName,
    appSource: input.appSource,
    appPath: input.appPath,
    appPackage: input.appPackage,
    appActivity: input.appActivity,
    defaultTimeoutMs: input.defaultTimeoutMs,
    navigationTimeoutMs: input.navigationTimeoutMs,
    strictLocators: input.strictLocators,
    extraCapabilities: input.extraCapabilities,
    recordVideo: run.recordVideo ?? true,
    capture: { console: run.capture?.console ?? true },
  };
}
