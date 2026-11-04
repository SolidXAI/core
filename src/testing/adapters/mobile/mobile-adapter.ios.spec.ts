import { FakeDriver } from "./fake-driver";
import { MobileAdapter } from "./mobile-adapter";
import type { MobileAdapterOptions } from "./mobile.types";

const UDID = "1674E718-0EBA-4568-9644-F18E0DDF7705";

function setup(overrides: Partial<MobileAdapterOptions> = {}) {
  const driver = new FakeDriver();
  const runCommand = jest.fn(async (_file: string, _args: string[]) => undefined);
  const adapter = new MobileAdapter({
    appiumUrl: "http://localhost:4723",
    udid: UDID,
    platformName: "iOS",
    simulator: true,
    appSource: "upload",
    appPath: "/builds/Sample.app",
    appPackage: "io.solidx.testhub.sample",
    appProcessName: "SampleApp",
    driverFactory: async () => driver,
    runCommand,
    ...overrides,
  });
  return { driver, adapter, runCommand };
}
const scripts = (driver: FakeDriver) => driver.callsTo("execute").map((call) => call.args[0]);
const grant = ["xcrun", ["simctl", "privacy", UDID, "grant", "all", "io.solidx.testhub.sample"]];

describe("MobileAdapter on iOS", () => {
  describe("start", () => {
    it("starts an XCUITest session and records with ffmpeg-friendly options", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      expect(adapter.ios).toBe(true);
      expect(driver.callsTo("startRecordingScreen")[0].args[0]).toEqual({
        videoType: "libx264",
        videoFps: 10,
        timeLimit: "1800",
        videoScale: "trunc(iw/4)*2:trunc(ih/4)*2",
      });
    });
  });

  describe("session start timeout", () => {
    it("waits longer for the first session, which builds WebDriverAgent, than for later ones", async () => {
      const first = setup();
      const factory = jest.fn(async () => first.driver);
      const firstAdapter = new MobileAdapter({ ...first.adapter["opts" as never] as MobileAdapterOptions, driverFactory: factory });
      await firstAdapter.start();
      expect((factory.mock.calls[0] as any[])[0].connectionRetryTimeout).toBe(600_000);
      const built = jest.fn(async () => first.driver);
      await new MobileAdapter({ ...first.adapter["opts" as never] as MobileAdapterOptions, wdaPrebuilt: true, driverFactory: built }).start();
      expect((built.mock.calls[0] as any[])[0].connectionRetryTimeout).toBe(240_000);
    });
  });

  describe("launch", () => {
    it("uses bundleId for every app command", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await adapter.launch();
      const calls = driver.callsTo("execute").map((call) => call.args);
      expect(calls[0]).toEqual(["mobile: terminateApp", { bundleId: "io.solidx.testhub.sample" }]);
      expect(calls.find((a) => a[0] === "mobile: activateApp")).toEqual(["mobile: activateApp", { bundleId: "io.solidx.testhub.sample" }]);
      expect(calls.find((a) => a[0] === "mobile: queryAppState")).toEqual(["mobile: queryAppState", { bundleId: "io.solidx.testhub.sample" }]);
    });

    it("clearData reinstalls the build instead of calling clearApp", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await adapter.launch({ clearData: true });
      expect(scripts(driver).slice(0, 4)).toEqual(["mobile: terminateApp", "mobile: removeApp", "mobile: installApp", "mobile: activateApp"]);
      expect(scripts(driver)).not.toContain("mobile: clearApp");
      expect(driver.callsTo("execute")[2].args[1]).toEqual({ app: "/builds/Sample.app" });
    });

    it("reinstalls an installed-source app too, when a build is known", async () => {
      const { adapter, driver } = setup({ appSource: "installed" });
      await adapter.start();
      await adapter.launch({ clearData: true });
      expect(scripts(driver)).toContain("mobile: installApp");
    });

    it("refuses clearData with no build to reinstall", async () => {
      const { adapter } = setup({ appSource: "installed", appPath: undefined });
      await adapter.start();
      await expect(adapter.launch({ clearData: true })).rejects.toThrow(
        "Clearing data on iOS needs a build to reinstall, and there is none for this device. Upload the build for this device (a Simulator .zip, or an iPhone .ipa), or start the scenario from the file's reset scenario.",
      );
    });

    it("explains a failed reinstall", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      driver.failingScripts.add("mobile: installApp");
      await expect(adapter.launch({ clearData: true })).rejects.toThrow(
        "Could not reinstall io.solidx.testhub.sample to clear its data: mobile: installApp failed",
      );
    });

    it("grants permissions after the install and before the app starts", async () => {
      const { adapter, driver, runCommand } = setup();
      await adapter.start();
      await adapter.launch({ clearData: true });
      expect(runCommand).toHaveBeenCalledWith(...grant);
      expect(runCommand).toHaveBeenCalledTimes(1);
      // The grant happens between the install and the activation: the calls it follows are all before activateApp.
      expect(scripts(driver).indexOf("mobile: installApp")).toBeLessThan(scripts(driver).indexOf("mobile: activateApp"));
    });

    it("grants on the first launch of a session, but not on later launches that keep the data", async () => {
      const { adapter, runCommand } = setup();
      await adapter.start();
      await adapter.launch();
      await adapter.launch();
      expect(runCommand).toHaveBeenCalledTimes(1);
      await adapter.launch({ clearData: true });
      expect(runCommand).toHaveBeenCalledTimes(2);
    });

    it("grantPermissions: false leaves the prompt alone", async () => {
      const { adapter, runCommand } = setup();
      await adapter.start();
      await adapter.launch({ clearData: true, grantPermissions: false });
      expect(runCommand).not.toHaveBeenCalled();
    });

    it("does not touch simctl for a device that is not a simulator", async () => {
      const { adapter, runCommand } = setup({ simulator: false });
      await adapter.start();
      await adapter.launch();
      expect(runCommand).not.toHaveBeenCalled();
    });

    it("carries on when the grant fails, and says so", async () => {
      const runCommand = jest.fn(async () => { throw new Error("simctl exploded\nmore"); });
      const { adapter } = setup({ runCommand });
      await adapter.start();
      await adapter.launch();
      expect(adapter.grantError).toBe("simctl exploded");
    });

    it("never passes an odd-looking id to simctl", async () => {
      const { adapter, runCommand } = setup({ appPackage: "-bad id" });
      await adapter.start();
      await adapter.launch();
      expect(runCommand).not.toHaveBeenCalled();
    });

    it("terminate uses bundleId", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await adapter.terminate();
      expect(driver.callsTo("execute")[0].args).toEqual(["mobile: terminateApp", { bundleId: "io.solidx.testhub.sample" }]);
    });
  });

  describe("device log", () => {
    it("reads syslog and keeps the app's own lines", async () => {
      const { adapter, driver } = setup({ capture: { console: true } });
      await adapter.start();
      driver.logs = [
        { level: "ALL", message: "2026-10-13 21:53:23.018 I SampleApp[1:2f] [x:y] hello" },
        { level: "ALL", message: "2026-10-13 21:53:23.018 I locationd[1:2f] [x:y] noise" },
      ];
      const artifacts = await adapter.collectFailureArtifacts();
      expect(driver.callsTo("getLogs")[0].args).toEqual(["syslog"]);
      expect(JSON.parse(String(artifacts[0].data))).toEqual([{ type: "info", text: expect.stringContaining("hello") }]);
    });

    it("drains syslog when a scenario starts", async () => {
      const { adapter, driver } = setup({ capture: { console: true } });
      await adapter.start();
      await adapter.resetCapture();
      expect(driver.callsTo("getLogs")[0].args).toEqual(["syslog"]);
    });
  });

  describe("android is unchanged", () => {
    it("still uses appId and clearApp", async () => {
      const driver = new FakeDriver();
      const adapter = new MobileAdapter({
        appiumUrl: "http://localhost:4723", udid: "emulator-5554", appSource: "installed",
        appPackage: "com.acme.app", appActivity: ".Main", driverFactory: async () => driver,
      });
      await adapter.start();
      await adapter.launch({ clearData: true });
      expect(driver.callsTo("execute")[0].args).toEqual(["mobile: terminateApp", { appId: "com.acme.app" }]);
      expect(scripts(driver)).toContain("mobile: clearApp");
    });
  });
});

describe("MobileAdapter on a real iPhone", () => {
  const PHONE = "00008140-001A202611B8801C";
  const phoneOptions: Partial<MobileAdapterOptions> = {
    udid: PHONE,
    simulator: false,
    appSource: "installed",
    appPath: undefined,
    appPackage: "com.oswald.mydemoapp",
    appProcessName: "My Demo App",
  };

  it("is a phone when it is iOS and not a simulator", () => {
    expect(setup(phoneOptions).adapter.phone).toBe(true);
    expect(setup().adapter.phone).toBe(false);
    expect(setup({ platformName: undefined, simulator: undefined }).adapter.phone).toBe(false);
  });

  it("clearData without an .ipa is refused before anything is sent to the phone (D41)", async () => {
    const { adapter, driver } = setup(phoneOptions);
    await adapter.start();
    expect(adapter.canReinstall).toBe(false);
    const before = driver.callsTo("execute").length;
    await expect(adapter.launch({ clearData: true })).rejects.toThrow("Clearing data on iOS needs a build to reinstall, and there is none for this device. Upload the build for this device (a Simulator .zip, or an iPhone .ipa), or start the scenario from the file's reset scenario.");
    expect(driver.callsTo("execute")).toHaveLength(before);
  });

  it("clearData with an uploaded .ipa removes the app and installs the build again", async () => {
    const { adapter, driver } = setup({ ...phoneOptions, appPath: "/builds/MyApp.ipa" });
    await adapter.start();
    expect(adapter.canReinstall).toBe(true);
    await adapter.launch({ clearData: true });
    const scripts = driver.callsTo("execute").map((call) => call.args[0]);
    expect(scripts).toContain("mobile: removeApp");
    expect(driver.callsTo("execute").find((call) => call.args[0] === "mobile: installApp")?.args[1]).toEqual({ app: "/builds/MyApp.ipa" });
  });

  it("a launch without clearData starts the installed app and never runs simctl", async () => {
    const { adapter, driver, runCommand } = setup(phoneOptions);
    await adapter.start();
    await adapter.launch();
    expect(scripts(driver)).toEqual(expect.arrayContaining(["mobile: terminateApp", "mobile: activateApp"]));
    expect(scripts(driver)).not.toContain("mobile: removeApp");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("the Simulator still reinstalls on clearData", async () => {
    const { adapter, driver } = setup();
    await adapter.start();
    await adapter.launch({ clearData: true });
    expect(scripts(driver)).toEqual(expect.arrayContaining(["mobile: removeApp", "mobile: installApp"]));
  });

  describe("why a session did not start", () => {
    const failingWith = (message: string, overrides: Partial<MobileAdapterOptions> = phoneOptions) =>
      setup({ ...overrides, driverFactory: async () => { throw new Error(message); } }).adapter.start();

    it.each([
      ["xcodebuild failed: The application has not been explicitly trusted by the user.", "Trust the developer on the iPhone: Settings › General › VPN & Device Management, then run again."],
      ["Failed to install: invalid code signature, inode, or entitlements", "Trust the developer on the iPhone: Settings › General › VPN & Device Management, then run again."],
      ["Provisioning profile \"iOS Team Provisioning Profile\" has expired", "WebDriverAgent's provisioning profile has expired. Run again: Test Hub rebuilds it."],
      ["Failed Registering Bundle Identifier: The app identifier \"io.solidx.wda.x\" cannot be registered to your development team because it is not available.", "Apple refused WebDriverAgent's app id. Set TESTHUB_IOS_WDA_BUNDLE_ID to another unique id."],
      ["The device is not ready: Developer Mode is disabled", "Turn on Developer Mode: Settings › Privacy & Security › Developer Mode."],
    ])("%s", async (raw, hint) => {
      await expect(failingWith(raw)).rejects.toThrow(hint);
    });

    it("keeps the first line of the original error in front of the fix", async () => {
      await expect(failingWith("xcodebuild failed: has not been explicitly trusted by the user.\nmore detail")).rejects.toThrow(
        /^xcodebuild failed: has not been explicitly trusted by the user\. Trust the developer/,
      );
    });

    it("rethrows an error it does not know unchanged", async () => {
      await expect(failingWith("connect ECONNREFUSED 127.0.0.1:4723")).rejects.toThrow("connect ECONNREFUSED 127.0.0.1:4723");
    });

    it("does not treat 'is not available' alone as an app id problem", async () => {
      await expect(failingWith("Simulator device is not available")).rejects.toThrow("Simulator device is not available");
    });

    it("leaves a simulator's errors alone, whatever they say", async () => {
      await expect(failingWith("has not been explicitly trusted by the user", {})).rejects.toThrow(/^has not been explicitly trusted by the user$/);
    });
  });
});
