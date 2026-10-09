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
