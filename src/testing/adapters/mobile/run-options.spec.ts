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

  it("passes the run's healing policy on, and leaves it unset when the run has none", () => {
    expect(toMobileAdapterOptions(input, { healing: "off" })).toMatchObject({ healing: "off" });
    expect(toMobileAdapterOptions(input).healing).toBeUndefined();
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

describe("toMobileAdapterOptions: phone signing", () => {
  const phone: MobileRunOptionsInput = {
    appiumUrl: "http://localhost:4723",
    udid: "00008140-001A202611B8801C",
    platformName: "iOS",
    simulator: false,
    appSource: "installed",
    appPackage: "com.oswald.mydemoapp",
  };

  it("copies wdaSigning", () => {
    expect(toMobileAdapterOptions({ ...phone, wdaSigning: { teamId: "LN5367MMM6", wdaBundleId: "io.solidx.wda.ln5367mmm6" } }).wdaSigning).toEqual({
      teamId: "LN5367MMM6",
      signingId: undefined,
      wdaBundleId: "io.solidx.wda.ln5367mmm6",
    });
  });

  it("copies only the known signing fields", () => {
    const sneaky = { teamId: "LN5367MMM6", extra: "x" } as unknown as NonNullable<MobileRunOptionsInput["wdaSigning"]>;
    expect(toMobileAdapterOptions({ ...phone, wdaSigning: sneaky }).wdaSigning).not.toHaveProperty("extra");
  });

  it("leaves wdaSigning out when there is none", () => {
    expect(toMobileAdapterOptions(phone).wdaSigning).toBeUndefined();
  });

  it.each(["short", "lowercase1", "TOOLONGTEAMID", "", "LN5367MMM!"])("rejects the team id %p", (teamId) => {
    expect(() => toMobileAdapterOptions({ ...phone, wdaSigning: { teamId } })).toThrow("wdaSigning.teamId must be a 10-character Apple team id");
  });

  it("rejects a WebDriverAgent bundle id that could be taken for an option", () => {
    expect(() => toMobileAdapterOptions({ ...phone, wdaSigning: { teamId: "LN5367MMM6", wdaBundleId: "-bad" } })).toThrow(
      "wdaSigning.wdaBundleId must look like io.example.wda",
    );
  });
});
