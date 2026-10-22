import type { MobileAdapterOptions, MobileRunOptionsInput } from "./mobile.types";
import { BUNDLE_ID_RE } from "./platform";

const TEAM_ID_RE = /^[A-Z0-9]{10}$/;

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
  const signing = input.wdaSigning;
  if (signing) {
    if (!TEAM_ID_RE.test(String(signing.teamId ?? ""))) {
      throw new Error(`wdaSigning.teamId must be a 10-character Apple team id, got "${String(signing.teamId)}"`);
    }
    if (signing.wdaBundleId !== undefined && !BUNDLE_ID_RE.test(String(signing.wdaBundleId))) {
      throw new Error(`wdaSigning.wdaBundleId must look like io.example.wda, got "${String(signing.wdaBundleId)}"`);
    }
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
    // Copied field by field, so nothing else rides along with it.
    wdaSigning: signing ? { teamId: signing.teamId, signingId: signing.signingId, wdaBundleId: signing.wdaBundleId } : undefined,
    defaultTimeoutMs: input.defaultTimeoutMs,
    navigationTimeoutMs: input.navigationTimeoutMs,
    strictLocators: input.strictLocators,
    extraCapabilities: input.extraCapabilities,
    recordVideo: run.recordVideo ?? true,
    capture: { console: run.capture?.console ?? true, screenshot: run.capture?.screenshotOnFailure ?? false },
  };
}
