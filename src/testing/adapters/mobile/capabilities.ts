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
 * The class chain of the buttons that allow a permission prompt on a phone (D44). "Allow Once" is left out on purpose: it is
 * listed before "Allow While Using App" on the location prompt, and its grant would not last. English labels only.
 */
export const IOS_ALLOW_BUTTON_SELECTOR = '**/XCUIElementTypeButton[`label IN {"Allow While Using App", "Allow", "OK"}`]';

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
    // The first session builds WebDriverAgent, which took 4.5 minutes on a small Mac; later ones reuse it (D34).
    "appium:wdaLaunchTimeout": o.wdaPrebuilt ? 240_000 : 480_000,
  };
  if (o.wdaDerivedDataPath) {
    caps["appium:derivedDataPath"] = o.wdaDerivedDataPath;
    caps["appium:usePrebuiltWDA"] = !!o.wdaPrebuilt;
  }
  // A phone only runs apps that are signed for it, and WebDriverAgent is one (D42). The team comes from the Mac's certificate.
  if (o.wdaSigning) {
    caps["appium:xcodeOrgId"] = o.wdaSigning.teamId;
    caps["appium:xcodeSigningId"] = o.wdaSigning.signingId ?? "Apple Development";
    caps["appium:updatedWDABundleId"] = o.wdaSigning.wdaBundleId ?? `io.solidx.wda.${o.wdaSigning.teamId.toLowerCase()}`;
    caps["appium:allowProvisioningDeviceRegistration"] = true;
  }
  if (!o.simulator) {
    // A WebDriverAgent setting, not a capability: as "appium:acceptAlertButtonSelector" the driver ignores it, and
    // WebDriverAgent's default rule then taps "Don't Allow" on a location prompt (spikes/mobile-ios/FINDINGS-ios-device.md).
    caps["appium:settings[acceptAlertButtonSelector]"] = IOS_ALLOW_BUTTON_SELECTOR;
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
