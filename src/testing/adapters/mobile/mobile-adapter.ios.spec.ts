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
        "Clearing data needs a build to reinstall. Upload the build on the application.",
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
