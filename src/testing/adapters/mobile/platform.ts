import type { MobileAdapterOptions } from "./mobile.types";

/** Whether a session drives an iOS device or simulator. Everything else is Android. */
export const isIos = (o: { platformName?: string }): boolean => o.platformName === "iOS";

/**
 * The app id argument of `mobile: terminateApp`, `activateApp`, `clearApp` and `queryAppState`: Android's driver calls it
 * `appId`, XCUITest calls it `bundleId`.
 */
export function appIdArg(o: Pick<MobileAdapterOptions, "platformName" | "appPackage">): Record<string, string> {
  return isIos(o) ? { bundleId: o.appPackage } : { appId: o.appPackage };
}
