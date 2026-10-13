import { buildCapabilities } from "./capabilities";
import type { MobileAdapterOptions } from "./mobile.types";

const base: MobileAdapterOptions = {
  appiumUrl: "http://localhost:4723",
  udid: "emulator-5554",
  appSource: "installed",
  appPackage: "com.acme.app",
  appActivity: ".MainActivity",
};

describe("buildCapabilities", () => {
  it("sets the base capabilities for every session", () => {
    const caps = buildCapabilities(base);
    expect(caps).toMatchObject({
      platformName: "Android",
      "appium:automationName": "UiAutomator2",
      "appium:udid": "emulator-5554",
      "appium:newCommandTimeout": 120,
      "appium:autoGrantPermissions": true,
    });
  });

  it("installed: opens the app by id, keeps its data and restarts it", () => {
    const caps = buildCapabilities(base);
    expect(caps).toMatchObject({
      "appium:appPackage": "com.acme.app",
      "appium:appActivity": ".MainActivity",
      "appium:noReset": true,
      "appium:forceAppLaunch": true,
      "appium:shouldTerminateApp": true,
    });
    expect(caps).not.toHaveProperty("appium:app");
  });

  it("upload: passes the APK and leaves noReset unset", () => {
    const caps = buildCapabilities({ ...base, appSource: "upload", appPath: "/tmp/app.apk", appActivity: undefined });
    expect(caps["appium:app"]).toBe("/tmp/app.apk");
    expect(caps).not.toHaveProperty("appium:noReset");
    expect(caps).not.toHaveProperty("appium:appActivity");
  });

  it("merges extra capabilities last, so they can override", () => {
    const caps = buildCapabilities({
      ...base,
      extraCapabilities: { "appium:newCommandTimeout": 300, "appium:language": "en" },
    });
    expect(caps["appium:newCommandTimeout"]).toBe(300);
    expect(caps["appium:language"]).toBe("en");
  });

  it("never asks Appium to boot an emulator", () => {
    expect(buildCapabilities(base)).not.toHaveProperty("appium:avd");
    expect(buildCapabilities({ ...base, extraCapabilities: {} })).not.toHaveProperty("appium:avdArgs");
  });

  it("requires a device", () => {
    expect(() => buildCapabilities({ ...base, udid: "" })).toThrow("A device is required (udid)");
  });

  it("requires appPackage", () => {
    expect(() => buildCapabilities({ ...base, appPackage: "" })).toThrow("appPackage is required");
  });

  it('requires appPath for "upload"', () => {
    expect(() => buildCapabilities({ ...base, appSource: "upload" })).toThrow(
      'appPath is required when appSource is "upload"',
    );
  });

  it('requires appActivity for "installed"', () => {
    expect(() => buildCapabilities({ ...base, appActivity: undefined })).toThrow(
      'appActivity is required when appSource is "installed"',
    );
  });

  it("rejects an unknown app source", () => {
    expect(() => buildCapabilities({ ...base, appSource: "store" as any })).toThrow('appSource must be "upload" or "installed"');
  });
});

describe("buildCapabilities: iOS", () => {
  const ios: MobileAdapterOptions = {
    appiumUrl: "http://localhost:4723",
    udid: "1674E718-0EBA-4568-9644-F18E0DDF7705",
    platformName: "iOS",
    appSource: "installed",
    appPackage: "io.solidx.testhub.sample",
  };

  it("uses XCUITest and the simulator's UDID", () => {
    expect(buildCapabilities(ios)).toMatchObject({
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:udid": "1674E718-0EBA-4568-9644-F18E0DDF7705",
      "appium:newCommandTimeout": 120,
      "appium:autoAcceptAlerts": true,
    });
  });

  it("has no Android-only keys and never an avd", () => {
    const caps = buildCapabilities(ios);
    for (const key of ["appium:avd", "appium:appPackage", "appium:appActivity", "appium:autoGrantPermissions"]) {
      expect(caps).not.toHaveProperty(key);
    }
  });

  it("installed: opens the app by bundle id, keeps its data and restarts it, without needing an activity", () => {
    const caps = buildCapabilities(ios);
    expect(caps).toMatchObject({
      "appium:bundleId": "io.solidx.testhub.sample",
      "appium:noReset": true,
      "appium:forceAppLaunch": true,
      "appium:shouldTerminateApp": true,
    });
    expect(caps).not.toHaveProperty("appium:app");
  });

  it("installed with a build: the build is kept for a reset, not installed at session start", () => {
    const caps = buildCapabilities({ ...ios, appPath: "/builds/Sample.app" });
    expect(caps).not.toHaveProperty("appium:app");
  });

  it("upload: passes the .app and needs a path", () => {
    expect(buildCapabilities({ ...ios, appSource: "upload", appPath: "/builds/Sample.app" })["appium:app"]).toBe("/builds/Sample.app");
    expect(() => buildCapabilities({ ...ios, appSource: "upload" })).toThrow('appPath is required when appSource is "upload"');
  });

  it("adds the WebDriverAgent cache only when a folder is given", () => {
    expect(buildCapabilities(ios)).not.toHaveProperty("appium:derivedDataPath");
    expect(buildCapabilities({ ...ios, wdaDerivedDataPath: "/w/xcode-27.0" })).toMatchObject({
      "appium:derivedDataPath": "/w/xcode-27.0",
      "appium:usePrebuiltWDA": false,
    });
    expect(buildCapabilities({ ...ios, wdaDerivedDataPath: "/w/xcode-27.0", wdaPrebuilt: true })).toMatchObject({
      "appium:usePrebuiltWDA": true,
    });
  });

  it("lets extra capabilities override, for example to leave alerts alone", () => {
    expect(buildCapabilities({ ...ios, extraCapabilities: { "appium:autoAcceptAlerts": false } })).toMatchObject({
      "appium:autoAcceptAlerts": false,
    });
  });

  it("still requires a device and an app id", () => {
    expect(() => buildCapabilities({ ...ios, udid: "" })).toThrow("A device is required");
    expect(() => buildCapabilities({ ...ios, appPackage: "" })).toThrow("appPackage is required");
  });
});
