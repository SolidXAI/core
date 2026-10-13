import type { MobileAdapterOptions } from "./mobile.types";
import { isIos } from "./platform";

/**
 * Appium capabilities for a session (D8). Every session names its device (`udid`): Appium must never
 * pick one itself, and `appium:avd` is never used because Test Hub boots emulators itself (D10).
 */
export function buildCapabilities(o: MobileAdapterOptions): Record<string, unknown> {
  if (!o.udid) {
    throw new Error("A device is required (udid): Appium must not pick a device itself");
  }
  if (!o.appPackage) {
    throw new Error("appPackage is required for a mobile session");
  }
  return isIos(o) ? iosCapabilities(o) : androidCapabilities(o);
}

function androidCapabilities(o: MobileAdapterOptions): Record<string, unknown> {
  const caps: Record<string, unknown> = {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
    "appium:udid": o.udid,
    "appium:newCommandTimeout": 120,
    "appium:autoGrantPermissions": true,
  };

  if (o.appSource === "upload") {
    if (!o.appPath) {
      throw new Error('appPath is required when appSource is "upload"');
    }
    // Appium installs the APK if needed and clears the app's data at session start.
    caps["appium:app"] = o.appPath;
  } else if (o.appSource === "installed") {
    if (!o.appActivity) {
      throw new Error('appActivity is required when appSource is "installed"');
    }
    caps["appium:appPackage"] = o.appPackage;
    caps["appium:appActivity"] = o.appActivity;
    // Keep the app's data, but restart it so the session starts on its home screen, not on
    // whatever screen the previous session left it on.
    caps["appium:noReset"] = true;
    caps["appium:forceAppLaunch"] = true;
    caps["appium:shouldTerminateApp"] = true;
  } else {
    throw new Error(`appSource must be "upload" or "installed", got "${String(o.appSource)}"`);
  }

  return { ...caps, ...(o.extraCapabilities ?? {}) };
}

/**
 * XCUITest session. `autoAcceptAlerts` handles the app's own alerts, but it denies permission prompts, so permissions are
 * granted another way (D28). WebDriverAgent is built once into `wdaDerivedDataPath` and reused (D34).
 */
function iosCapabilities(o: MobileAdapterOptions): Record<string, unknown> {
  const caps: Record<string, unknown> = {
    platformName: "iOS",
    "appium:automationName": "XCUITest",
    "appium:udid": o.udid,
    "appium:newCommandTimeout": 120,
    "appium:autoAcceptAlerts": true,
    "appium:wdaLaunchTimeout": 240_000,
  };
  if (o.wdaDerivedDataPath) {
    caps["appium:derivedDataPath"] = o.wdaDerivedDataPath;
    caps["appium:usePrebuiltWDA"] = !!o.wdaPrebuilt;
  }

  if (o.appSource === "upload") {
    if (!o.appPath) {
      throw new Error('appPath is required when appSource is "upload"');
    }
    // Appium installs the .app folder.
    caps["appium:app"] = o.appPath;
  } else if (o.appSource === "installed") {
    caps["appium:bundleId"] = o.appPackage;
    caps["appium:noReset"] = true;
    caps["appium:forceAppLaunch"] = true;
    caps["appium:shouldTerminateApp"] = true;
  } else {
    throw new Error(`appSource must be "upload" or "installed", got "${String(o.appSource)}"`);
  }

  return { ...caps, ...(o.extraCapabilities ?? {}) };
}
