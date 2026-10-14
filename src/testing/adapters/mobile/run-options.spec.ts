import { toMobileAdapterOptions } from "./run-options";
import type { MobileRunOptionsInput } from "./mobile.types";

const input: MobileRunOptionsInput = {
  appiumUrl: "http://localhost:4723",
  udid: "emulator-5554",
  appSource: "upload",
  appPath: "/builds/app.apk",
  appPackage: "com.acme.app",
};

describe("toMobileAdapterOptions", () => {
  it("copies the request fields", () => {
    expect(toMobileAdapterOptions(input)).toMatchObject(input);
  });

  it("records video and captures the device log by default", () => {
    expect(toMobileAdapterOptions(input)).toMatchObject({ recordVideo: true, capture: { console: true } });
  });

  it("follows the run's own recordVideo and capture settings", () => {
    expect(toMobileAdapterOptions(input, { recordVideo: false, capture: { console: false } })).toMatchObject({
      recordVideo: false,
      capture: { console: false },
    });
  });

  it("drops unknown fields, including a driver factory", () => {
    const sneaky = { ...input, driverFactory: () => undefined, somethingElse: 1 } as unknown as MobileRunOptionsInput;
    const result = toMobileAdapterOptions(sneaky) as unknown as Record<string, unknown>;
    expect(result.driverFactory).toBeUndefined();
    expect(result.somethingElse).toBeUndefined();
  });
});

describe("toMobileAdapterOptions: screenshots", () => {
  const base = { appiumUrl: "http://localhost:4723", udid: "u", appSource: "installed" as const, appPackage: "com.acme.app", appActivity: ".A" };

  it("does not take a failure screenshot unless the run asks for one", () => {
    expect(toMobileAdapterOptions(base).capture?.screenshot).toBe(false);
    expect(toMobileAdapterOptions(base, { capture: { screenshotOnFailure: false } }).capture?.screenshot).toBe(false);
  });

  it("follows the run's screenshotOnFailure setting", () => {
    expect(toMobileAdapterOptions(base, { capture: { screenshotOnFailure: true } }).capture?.screenshot).toBe(true);
  });
});

describe("toMobileAdapterOptions: iOS", () => {
  const ios: MobileRunOptionsInput = {
    appiumUrl: "http://localhost:4723",
    udid: "1674E718-0EBA-4568-9644-F18E0DDF7705",
    platformName: "iOS",
    simulator: true,
    appSource: "upload",
    appPath: "/builds/Sample.app",
    appPackage: "io.solidx.testhub.sample",
    appProcessName: "SampleApp",
    wdaDerivedDataPath: "/w/xcode-27.0",
    wdaPrebuilt: true,
  };

  it("copies the iOS fields", () => {
    expect(toMobileAdapterOptions(ios)).toMatchObject(ios);
  });

  it("rejects an unknown platform", () => {
    expect(() => toMobileAdapterOptions({ ...ios, platformName: "Windows" as never })).toThrow(
      'platformName must be "Android" or "iOS", got "Windows"',
    );
  });

  it("accepts a run with no platform, which means Android", () => {
    const { platformName, ...android } = ios;
    expect(platformName).toBe("iOS");
    expect(toMobileAdapterOptions(android).platformName).toBeUndefined();
  });
});
