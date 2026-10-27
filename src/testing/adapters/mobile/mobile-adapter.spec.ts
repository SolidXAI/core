import { DEFAULT_UI_TIMEOUT_MS } from "../ui/playwright-adapter";
import { FakeClock, FakeDriver, FakeElement } from "./fake-driver";
import { MobileAdapter } from "./mobile-adapter";
import type { MobileAdapterOptions, MobileRemoteOptions } from "./mobile.types";

function setup(overrides: Partial<MobileAdapterOptions> = {}) {
  const driver = new FakeDriver();
  const factory = jest.fn(async (_options: MobileRemoteOptions) => driver);
  const adapter = new MobileAdapter({
    appiumUrl: "http://localhost:4723",
    udid: "emulator-5554",
    appSource: "installed",
    appPackage: "com.acme.app",
    appActivity: ".MainActivity",
    driverFactory: factory,
    clock: new FakeClock(),
    ...overrides,
  });
  return { driver, factory, adapter };
}

describe("MobileAdapter", () => {
  describe("start", () => {
    it("builds remote options from the Appium URL and the capabilities", async () => {
      const { adapter, factory } = setup({ appiumUrl: "http://127.0.0.1:4725/wd/hub" });
      await adapter.start();
      const options = factory.mock.calls[0][0];
      expect(options).toMatchObject({ protocol: "http", hostname: "127.0.0.1", port: 4725, path: "/wd/hub" });
      expect(options.capabilities).toMatchObject({ "appium:udid": "emulator-5554", "appium:appPackage": "com.acme.app" });
      expect(adapter.isStarted()).toBe(true);
    });

    it("uses default ports for URLs without one", async () => {
      const http = setup({ appiumUrl: "http://appium.test" });
      await http.adapter.start();
      expect(http.factory.mock.calls[0][0]).toMatchObject({ protocol: "http", port: 80, path: "/" });
      const https = setup({ appiumUrl: "https://appium.test" });
      await https.adapter.start();
      expect(https.factory.mock.calls[0][0]).toMatchObject({ protocol: "https", port: 443 });
    });

    it("rejects an invalid Appium URL", async () => {
      await expect(setup({ appiumUrl: "not a url" }).adapter.start()).rejects.toThrow(
        'appiumUrl is not a valid URL: "not a url"',
      );
    });

    it("starts screen recording with the size caps, and carries on if it cannot", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      expect(driver.callsTo("startRecordingScreen")[0].args[0]).toEqual({
        videoSize: "720x1600",
        bitRate: 2_000_000,
        timeLimit: "1800",
      });

      const failing = setup();
      failing.driver.failing.add("startRecordingScreen");
      await failing.adapter.start();
      expect(failing.adapter.isStarted()).toBe(true);
      expect(failing.adapter.recordingError).toBe("startRecordingScreen failed");
    });

    it("does not record when recordVideo is off", async () => {
      const { adapter, driver } = setup({ recordVideo: false });
      await adapter.start();
      expect(driver.callsTo("startRecordingScreen")).toHaveLength(0);
    });

    it("getDriver throws before the session starts", () => {
      expect(() => setup().adapter.getDriver()).toThrow("Mobile session is not started");
    });
  });

  describe("default WebdriverIO loader", () => {
    afterEach(() => jest.resetModules());

    it("calls remote() from the webdriverio package", async () => {
      const driver = new FakeDriver();
      const remote = jest.fn(async () => driver);
      jest.doMock("webdriverio", () => ({ remote }), { virtual: true });
      const { MobileAdapter: Fresh } = await import("./mobile-adapter");
      const adapter = new Fresh({ appiumUrl: "http://localhost:4723", udid: "u", appSource: "installed", appPackage: "p", appActivity: ".A" });
      await adapter.start();
      expect(remote).toHaveBeenCalledTimes(1);
      expect(adapter.getDriver()).toBe(driver);
    });

    it("explains how to install webdriverio when it is missing", async () => {
      jest.doMock(
        "webdriverio",
        () => {
          throw Object.assign(new Error("Cannot find module 'webdriverio'"), { code: "MODULE_NOT_FOUND" });
        },
        { virtual: true },
      );
      const { MobileAdapter: Fresh } = await import("./mobile-adapter");
      const adapter = new Fresh({ appiumUrl: "http://localhost:4723", udid: "u", appSource: "installed", appPackage: "p", appActivity: ".A" });
      await expect(adapter.start()).rejects.toThrow(
        'Mobile scenarios need the "webdriverio" package. Install it in the app that runs tests: npm i webdriverio@^10.0.1',
      );
    });

    it("reports other load failures with their own message", async () => {
      jest.doMock(
        "webdriverio",
        () => {
          throw new Error("boom");
        },
        { virtual: true },
      );
      const { MobileAdapter: Fresh } = await import("./mobile-adapter");
      const adapter = new Fresh({ appiumUrl: "http://localhost:4723", udid: "u", appSource: "installed", appPackage: "p", appActivity: ".A" });
      await expect(adapter.start()).rejects.toThrow('Could not load "webdriverio": boom');
    });
  });

  describe("timeouts (D7)", () => {
    it("defaults to the UI adapter's timeout, and navigation follows it", () => {
      const { adapter } = setup();
      expect(adapter.resolveTimeout()).toBe(DEFAULT_UI_TIMEOUT_MS);
      expect(adapter.resolveNavigationTimeout()).toBe(DEFAULT_UI_TIMEOUT_MS);
    });

    it("honours adapter settings, and a step's own timeout wins", () => {
      const { adapter } = setup({ defaultTimeoutMs: 5000, navigationTimeoutMs: 9000 });
      expect(adapter.resolveTimeout()).toBe(5000);
      expect(adapter.resolveNavigationTimeout()).toBe(9000);
      expect(adapter.resolveTimeout(1234)).toBe(1234);
      expect(adapter.resolveNavigationTimeout(4321)).toBe(4321);
    });
  });

  describe("find", () => {
    const save = { by: "accessibilityId", value: "Save" };

    it("returns the single match", async () => {
      const { adapter, driver } = setup();
      const [element] = driver.add("~Save", new FakeElement());
      await adapter.start();
      expect(await adapter.find(save)).toBe(element);
    });

    it("fails with the label when nothing matches, using the step timeout in the message", async () => {
      const { adapter } = setup();
      await adapter.start();
      await expect(adapter.find(save, 3000)).rejects.toThrow(
        'No element matches { by: "accessibilityId", value: "Save" } after 3000 ms',
      );
    });

    it("fails on several matches in strict mode (D6)", async () => {
      const { adapter, driver } = setup();
      driver.add("~Save", new FakeElement(), new FakeElement());
      await adapter.start();
      await expect(adapter.find(save)).rejects.toThrow(
        'Locator { by: "accessibilityId", value: "Save" } matched 2 elements; make it unique or add "index"',
      );
    });

    it("uses the first match when strict locators are off", async () => {
      const { adapter, driver } = setup({ strictLocators: false });
      const [first] = driver.add("~Save", new FakeElement(), new FakeElement());
      await adapter.start();
      expect(await adapter.find(save)).toBe(first);
    });

    it("picks the match at index, and reports an index that is out of range", async () => {
      const { adapter, driver } = setup();
      const [, second] = driver.add("~Save", new FakeElement(), new FakeElement());
      await adapter.start();
      expect(await adapter.find({ ...save, index: 1 })).toBe(second);
      await expect(adapter.find({ ...save, index: 5 })).rejects.toThrow(
        'Locator { by: "accessibilityId", value: "Save", index: 5 } has no match at index 5 (found 2)',
      );
    });

    it("rejects an invalid locator before touching the device", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await expect(adapter.find("Save")).rejects.toThrow("locator must be an object");
      expect(driver.callsTo("$$")).toHaveLength(0);
    });
  });

  describe("findDisplayed and waitHidden", () => {
    it("waits for the element to be displayed", async () => {
      const { adapter, driver } = setup();
      const [element] = driver.add("~Hello", new FakeElement());
      await adapter.start();
      await adapter.findDisplayed({ by: "accessibilityId", value: "Hello" });
      expect(element.displayChecks).toBe(1);
    });

    it("looks the element up once per poll, with no second lookup after a match", async () => {
      const { adapter, driver } = setup();
      driver.add("~Hello", new FakeElement());
      await adapter.start();
      await adapter.findDisplayed({ by: "accessibilityId", value: "Hello" });
      expect(driver.callsTo("$$")).toHaveLength(1);
      expect(driver.callsTo("waitUntil")).toHaveLength(0);
    });

    it("returns as soon as the element appears, not after the whole timeout", async () => {
      const clock = new FakeClock();
      const { adapter, driver } = setup({ clock });
      await adapter.start();
      const appearsAfter = 2; // polls
      const realLookup = driver.$$.bind(driver);
      driver.$$ = async (selector: string) => {
        if (driver.callsTo("$$").length >= appearsAfter) driver.add("~Late", new FakeElement());
        return realLookup(selector);
      };
      await adapter.findDisplayed({ by: "accessibilityId", value: "Late" }, 30_000);
      expect(clock.sleeps.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1500);
    });

    it("keeps polling while the element is there but not yet displayed", async () => {
      const clock = new FakeClock();
      const { adapter, driver } = setup({ clock });
      const [element] = driver.add("~Slow", new FakeElement({ displayed: false }));
      await adapter.start();
      // The element is shown after the adapter has slept once, i.e. on the second poll.
      const sleep = clock.sleep.bind(clock);
      clock.sleep = async (ms: number) => {
        await sleep(ms);
        element.displayed = true;
      };
      await expect(adapter.findDisplayed({ by: "accessibilityId", value: "Slow" }, 5000)).resolves.toBe(element);
      expect(element.displayChecks).toBe(2);
      expect(driver.callsTo("$$")).toHaveLength(2);
    });

    it("fails with a displayed-specific message", async () => {
      const { adapter, driver } = setup();
      driver.add("~Hello", new FakeElement({ displayed: false }));
      await adapter.start();
      await expect(adapter.findDisplayed({ by: "accessibilityId", value: "Hello" }, 2000)).rejects.toThrow(
        '{ by: "accessibilityId", value: "Hello" } is not displayed after 2000 ms',
      );
    });

    it("waitHidden passes when nothing matches or nothing is displayed", async () => {
      const { adapter, driver } = setup();
      driver.add("~Hidden", new FakeElement({ displayed: false }));
      await adapter.start();
      await adapter.waitHidden({ by: "accessibilityId", value: "Gone" });
      await adapter.waitHidden({ by: "accessibilityId", value: "Hidden" });
    });

    it("waitHidden fails while a match is displayed", async () => {
      const { adapter, driver } = setup();
      driver.add("~Shown", new FakeElement());
      await adapter.start();
      await expect(adapter.waitHidden({ by: "accessibilityId", value: "Shown" }, 1500)).rejects.toThrow(
        '{ by: "accessibilityId", value: "Shown" } is still visible after 1500 ms',
      );
    });
  });

  describe("a device that stops answering", () => {
    const hello = { by: "accessibilityId", value: "Hello" };
    // Real time on purpose: the point is a call that really is slow compared with the step's timeout.
    const realClock = { now: () => Date.now(), sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) };

    it("fails the step at its timeout instead of waiting for the stalled lookup", async () => {
      const { adapter, driver } = setup({ clock: realClock });
      driver.add("~Hello", new FakeElement());
      driver.lookupDelayMs = 1500;
      await adapter.start();
      const startedAt = Date.now();
      await expect(adapter.findDisplayed(hello, 100)).rejects.toThrow(
        'The device did not answer while looking for { by: "accessibilityId", value: "Hello" } within the 100 ms timeout',
      );
      // Well short of the stall: the step ended at its own deadline, give or take a busy machine.
      expect(Date.now() - startedAt).toBeLessThan(1000);
    });

    it("applies the same limit to a stalled display check and to waitHidden", async () => {
      const { adapter, driver } = setup({ clock: realClock });
      const [element] = driver.add("~Hello", new FakeElement());
      element.isDisplayedDelayMs = 1500;
      await adapter.start();
      await expect(adapter.findDisplayed(hello, 100)).rejects.toThrow("The device did not answer while checking");
      await expect(adapter.waitHidden(hello, 100)).rejects.toThrow("The device did not answer");
    });

    it("does not report an unhandled rejection when the abandoned call fails later", async () => {
      const { adapter, driver } = setup({ clock: realClock });
      driver.lookupDelayMs = 200;
      driver.failing.add("$$");
      await adapter.start();
      const unhandled = jest.fn();
      process.on("unhandledRejection", unhandled);
      await expect(adapter.find(hello, 50)).rejects.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 300));
      process.off("unhandledRejection", unhandled);
      expect(unhandled).not.toHaveBeenCalled();
    });

    it("reports the slowest lookup once, then starts counting again", async () => {
      const { adapter, driver } = setup({ clock: realClock });
      driver.add("~Hello", new FakeElement());
      driver.lookupDelayMs = 120;
      await adapter.start();
      await adapter.find(hello);
      expect(adapter.takeSlowestCallMs()).toBeGreaterThanOrEqual(100);
      expect(adapter.takeSlowestCallMs()).toBe(0);
    });
  });

  describe("attach", () => {
    const opts = { appPackage: "com.acme.app", appActivity: ".MainActivity", clock: new FakeClock() };

    it("runs on the caller's driver without opening, recording or ending a session", async () => {
      const driver = new FakeDriver();
      const [button] = driver.add("~Save", new FakeElement());
      const adapter = MobileAdapter.attach(driver, opts);
      expect(adapter.isStarted()).toBe(true);
      expect(await adapter.find({ by: "accessibilityId", value: "Save" })).toBe(button);
      await adapter.stop({ keepVideo: true });
      expect(adapter.isStarted()).toBe(false);
      expect(driver.callsTo("startRecordingScreen")).toHaveLength(0);
      expect(driver.callsTo("stopRecordingScreen")).toHaveLength(0);
      expect(driver.callsTo("deleteSession")).toHaveLength(0);
    });

    it("reads the page source from the attached driver", async () => {
      const driver = new FakeDriver();
      driver.pageSource = "<hierarchy/>";
      expect(await MobileAdapter.attach(driver, opts).getPageSource()).toBe("<hierarchy/>");
    });

    it("keeps the platform: an iOS adapter without simulator is a phone", () => {
      const driver = new FakeDriver();
      expect(MobileAdapter.attach(driver, { ...opts, platformName: "iOS" }).phone).toBe(true);
      expect(MobileAdapter.attach(driver, { ...opts, platformName: "iOS", simulator: true }).phone).toBe(false);
      expect(MobileAdapter.attach(driver, opts).phone).toBe(false);
    });
  });

  describe("describeLocator", () => {
    it("returns the printable label, and rejects an invalid locator", () => {
      const { adapter } = setup();
      expect(adapter.describeLocator({ by: "id", value: "edit", index: 2 })).toBe('{ by: "id", value: "edit", index: 2 }');
      expect(() => adapter.describeLocator("edit")).toThrow("locator must be an object");
    });
  });

  describe("launch and terminate", () => {
    it("terminates, then activates, and waits for the foreground", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await adapter.launch();
      const scripts = driver.callsTo("execute").map((call) => call.args[0]);
      expect(scripts).toEqual(["mobile: terminateApp", "mobile: activateApp", "mobile: queryAppState"]);
      expect(driver.callsTo("execute")[0].args[1]).toEqual({ appId: "com.acme.app" });
    });

    it("clears the app's data between terminate and activate when asked", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await adapter.launch({ clearData: true });
      const scripts = driver.callsTo("execute").map((call) => call.args[0]);
      expect(scripts.slice(0, 4)).toEqual(["mobile: terminateApp", "mobile: clearApp", "mobile: changePermissions", "mobile: activateApp"]);
    });

    describe("permissions after a wipe on Android", () => {
      it("grants every permission again after clearing the data", async () => {
        const { adapter, driver } = setup();
        await adapter.start();
        await adapter.launch({ clearData: true });
        const grant = driver.callsTo("execute").find((call) => call.args[0] === "mobile: changePermissions");
        expect(grant?.args[1]).toEqual({ permissions: "all", appPackage: "com.acme.app", action: "grant" });
      });

      it("does not when the scenario tests the prompt, or when nothing was cleared", async () => {
        const { adapter, driver } = setup();
        await adapter.start();
        await adapter.launch({ clearData: true, grantPermissions: false });
        await adapter.launch();
        const scripts = driver.callsTo("execute").map((call) => call.args[0]);
        expect(scripts).not.toContain("mobile: changePermissions");
      });

      it("notes a failure and still launches", async () => {
        const { adapter, driver } = setup();
        driver.failingScripts.add("mobile: changePermissions");
        await adapter.start();
        await adapter.launch({ clearData: true });
        expect(adapter.grantError).toBe("mobile: changePermissions failed");
        expect(driver.callsTo("execute").map((call) => call.args[0])).toContain("mobile: activateApp");
      });
    });

    it("fails if the app never reaches the foreground, naming the navigation timeout", async () => {
      const { adapter, driver } = setup({ navigationTimeoutMs: 7000 });
      driver.appState = 1;
      await adapter.start();
      await expect(adapter.launch()).rejects.toThrow("com.acme.app did not reach the foreground within 7000 ms");
    });

    it("starts the app again when Android stops it while it is starting", async () => {
      const { adapter, driver } = setup();
      // Background (starting), then killed, then up after the second start.
      driver.appStates = [3, 1, 4];
      await adapter.start();
      await adapter.launch();
      const scripts = driver.callsTo("execute").map((call) => call.args[0]);
      expect(scripts.filter((script) => script === "mobile: activateApp")).toHaveLength(2);
    });

    it("gives up after two more starts and says what the app was doing", async () => {
      const { adapter, driver } = setup({ navigationTimeoutMs: 7000 });
      driver.appState = 1;
      await adapter.start();
      await expect(adapter.launch()).rejects.toThrow(
        "did not reach the foreground within 7000 ms (last state: not running, started again 2 times). The app was started but stopped again; the device may be overloaded. See the device log.",
      );
      const scripts = driver.callsTo("execute").map((call) => call.args[0]);
      expect(scripts.filter((script) => script === "mobile: activateApp")).toHaveLength(3);
    });

    it("does not start it again when it is merely slow", async () => {
      const { adapter, driver } = setup();
      driver.appStates = [3, 3, 4];
      await adapter.start();
      await adapter.launch();
      const scripts = driver.callsTo("execute").map((call) => call.args[0]);
      expect(scripts.filter((script) => script === "mobile: activateApp")).toHaveLength(1);
    });

    it("terminate stops the app", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await adapter.terminate();
      expect(driver.callsTo("execute")[0].args).toEqual(["mobile: terminateApp", { appId: "com.acme.app" }]);
    });
  });

  describe("capture", () => {
    it("resetCapture drains the log only when console capture is on", async () => {
      const off = setup();
      await off.adapter.start();
      await off.adapter.resetCapture();
      expect(off.driver.callsTo("getLogs")).toHaveLength(0);

      const on = setup({ capture: { console: true } });
      await on.adapter.start();
      await on.adapter.resetCapture();
      expect(on.driver.callsTo("getLogs")[0].args).toEqual(["logcat"]);
    });

    it("collects the device log as console.json", async () => {
      const { adapter, driver } = setup({ capture: { console: true } });
      driver.logs = [
        { level: "ALL", message: "10-09 09:49:37.434   363  3815 E AndroidRuntime: boom" },
        { level: "ALL", message: "10-09 09:49:37.500   363  3815 I resolv  : system noise" },
        { level: "ALL", message: "10-09 09:49:37.600   363  3815 W com.acme.app: hmm" },
      ];
      await adapter.start();
      const artifacts = await adapter.collectFailureArtifacts();
      const log = artifacts.find((a) => a.name === "console.json")!;
      expect(log.contentType).toBe("application/json");
      expect(JSON.parse(log.data as string)).toEqual([
        { type: "error", text: "10-09 09:49:37.434   363  3815 E AndroidRuntime: boom" },
        { type: "warning", text: "10-09 09:49:37.600   363  3815 W com.acme.app: hmm" },
      ]);
      // A screenshot is a binary upload nothing refers to, so it is not taken unless asked for.
      expect(artifacts.map((a) => a.name)).toEqual(["console.json"]);
      expect(driver.callsTo("takeScreenshot")).toHaveLength(0);
    });

    it("takes a screenshot of the failing screen when capture.screenshot is on", async () => {
      const { adapter, driver } = setup({ capture: { console: true, screenshot: true } });
      driver.logs = [{ level: "ALL", message: "10-09 09:49:37.434   363  3815 E AndroidRuntime: boom" }];
      await adapter.start();
      const artifacts = await adapter.collectFailureArtifacts();
      expect(artifacts.map((a) => a.name)).toEqual(["console.json", "screenshot.png", "page-source.xml"]);
      const shot = artifacts.find((a) => a.name === "screenshot.png")!;
      expect(shot.contentType).toBe("image/png");
      expect(Buffer.isBuffer(shot.data)).toBe(true);
      expect((shot.data as Buffer).toString()).toBe("png-bytes");
    });

    it("keeps the screen's element tree next to the screenshot, and carries on when it cannot be read", async () => {
      const { adapter, driver } = setup({ capture: { console: false, screenshot: true } });
      driver.pageSource = '<hierarchy><node text="Save"/></hierarchy>';
      await adapter.start();
      const source = (await adapter.collectFailureArtifacts()).find((a) => a.name === "page-source.xml")!;
      expect(source).toMatchObject({ contentType: "application/xml", data: '<hierarchy><node text="Save"/></hierarchy>' });

      driver.failing.add("getPageSource");
      expect((await adapter.collectFailureArtifacts()).map((a) => a.name)).toEqual(["screenshot.png"]);
    });

    it("does not read the page source unless a screenshot was asked for", async () => {
      const { adapter, driver } = setup({ capture: { console: true } });
      await adapter.start();
      await adapter.collectFailureArtifacts();
      expect(driver.callsTo("getPageSource")).toHaveLength(0);
    });

    it("keeps only the newest 500 log entries", async () => {
      const { adapter, driver } = setup({ capture: { console: true } });
      driver.logs = Array.from({ length: 700 }, (_, i) => ({ level: "ALL", message: `10-09 09:49:37.434   363  3815 E Tag: m${i}` }));
      await adapter.start();
      const artifacts = await adapter.collectFailureArtifacts();
      const entries = JSON.parse(artifacts.find((a) => a.name === "console.json")!.data as string);
      expect(entries).toHaveLength(500);
      expect(entries[0].text).toContain("m200");
    });

    it("skips console.json when there is no log, and does not capture the log when capture is off", async () => {
      const empty = setup({ capture: { console: true } });
      await empty.adapter.start();
      expect(await empty.adapter.collectFailureArtifacts()).toEqual([]);

      const off = setup();
      await off.adapter.start();
      await off.adapter.collectFailureArtifacts();
      expect(off.driver.callsTo("getLogs")).toHaveLength(0);
    });

    it("survives each part failing", async () => {
      const { adapter, driver } = setup({ capture: { console: true } });
      driver.failing.add("getLogs");
      driver.failing.add("takeScreenshot");
      await adapter.start();
      await expect(adapter.collectFailureArtifacts()).resolves.toEqual([]);
      await expect(adapter.resetCapture()).resolves.toBeUndefined();
    });

    it("returns nothing when the session is not started", async () => {
      expect(await setup().adapter.collectFailureArtifacts()).toEqual([]);
    });
  });

  describe("stop", () => {
    it("keeps the recording as run.mp4 when asked", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await adapter.stop({ keepVideo: true });
      const video = adapter.getRunVideo()!;
      expect(video).toMatchObject({ name: "run.mp4", contentType: "video/mp4" });
      expect((video.data as Buffer).toString()).toBe("mp4-bytes");
      expect(driver.callsTo("deleteSession")).toHaveLength(1);
      expect(adapter.isStarted()).toBe(false);
    });

    it("discards the recording when the run passed", async () => {
      const { adapter, driver } = setup();
      await adapter.start();
      await adapter.stop({ keepVideo: false });
      expect(adapter.getRunVideo()).toBeUndefined();
      expect(driver.callsTo("stopRecordingScreen")).toHaveLength(1);
    });

    it("never throws, and still closes the session, when stopping the recording fails", async () => {
      const { adapter, driver } = setup();
      driver.failing.add("stopRecordingScreen");
      await adapter.start();
      await expect(adapter.stop({ keepVideo: true })).resolves.toBeUndefined();
      expect(adapter.getRunVideo()).toBeUndefined();
      expect(driver.callsTo("deleteSession")).toHaveLength(1);
    });

    it("never throws when closing the session fails, or when never started", async () => {
      const { adapter, driver } = setup();
      driver.failing.add("deleteSession");
      await adapter.start();
      await expect(adapter.stop()).resolves.toBeUndefined();
      await expect(setup().adapter.stop()).resolves.toBeUndefined();
    });
  });
});
