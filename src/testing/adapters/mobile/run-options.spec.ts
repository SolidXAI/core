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
