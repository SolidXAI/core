import { FakeClock, FakeDriver, FakeElement } from "../adapters/mobile/fake-driver";
import { MobileAdapter } from "../adapters/mobile/mobile-adapter";
import type { MobileAdapterOptions } from "../adapters/mobile/mobile.types";
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { RecordingReporter } from "./recording-reporter";
import { runFromMetadata } from "./run-from-metadata";

function mobileOptions(driver: FakeDriver) {
  const factory = jest.fn(async () => driver);
  const options: MobileAdapterOptions = {
    appiumUrl: "http://localhost:4723",
    udid: "emulator-5554",
    appSource: "installed",
    appPackage: "com.acme.app",
    appActivity: ".MainActivity",
    capture: { console: true },
    driverFactory: factory,
    clock: new FakeClock(),
  };
  return { options, factory };
}

const save = { by: "accessibilityId", value: "Save" };
const passing: ScenarioSpec = {
  id: "mobile-pass",
  type: "mobile",
  steps: [{ given: { op: "mobile.launch", with: { clearData: true } } }, { when: { op: "mobile.tap", with: { locator: save } } }],
};
const failing: ScenarioSpec = {
  id: "mobile-fail",
  type: "mobile",
  steps: [{ op: "mobile.tap", with: { locator: { by: "accessibilityId", value: "Missing" }, timeoutMs: 1000 } }],
};

describe("runFromMetadata with mobile scenarios", () => {
  it("reports a step's slowest device call only when it was slow, and counts afresh for each step", async () => {
    const driver = new FakeDriver();
    driver.add("~Save", new FakeElement());
    const { options } = mobileOptions(driver);
    const reporter = new RecordingReporter();
    const slowest = jest.spyOn(MobileAdapter.prototype, "takeSlowestCallMs").mockReturnValueOnce(31_000).mockReturnValueOnce(120);
    try {
      await runFromMetadata({ scenarios: [passing], mobile: options, reporter });
    } finally {
      slowest.mockRestore();
    }
    expect(reporter.stepEnds.map((e) => [e.op, e.slowestCallMs])).toEqual([
      ["mobile.launch", 31_000],
      ["mobile.tap", undefined],
    ]);
  });

  it("runs a mobile scenario on one session and discards the recording when it passes", async () => {
    const driver = new FakeDriver();
    const [button] = driver.add("~Save", new FakeElement());
    const { options, factory } = mobileOptions(driver);
    const reporter = new RecordingReporter();

    await runFromMetadata({ scenarios: [passing], mobile: options, reporter });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(button.calls).toContain("click");
    expect(reporter.scenarioEnds).toEqual([{ id: "mobile-pass", ok: true }]);
    expect(reporter.runArtifacts).toEqual([]);
    expect(reporter.attachments).toEqual([]);
    expect(driver.callsTo("deleteSession")).toHaveLength(1);
    expect(reporter.runEnd).toMatchObject({ ok: true, passed: 1, failed: 0 });
  });

  it("passes a step that needed its fallback, and reports the heal on scenario.end", async () => {
    const driver = new FakeDriver();
    const [renamed] = driver.add("~Save order", new FakeElement());
    const { options } = mobileOptions(driver);
    const healable: ScenarioSpec = {
      id: "mobile-heal",
      type: "mobile",
      steps: [
        { given: { op: "mobile.launch", with: { clearData: true } } },
        { when: { op: "mobile.tap", with: { locator: save, fallbacks: [{ by: "accessibilityId", value: "Save order" }] } } },
      ],
    };
    const reporter = new RecordingReporter();

    await runFromMetadata({ scenarios: [healable], mobile: options, reporter });

    expect(renamed.calls).toContain("click");
    expect(reporter.scenarioEnds).toEqual([{ id: "mobile-heal", ok: true }]);
    expect(reporter.heals["mobile-heal"]).toEqual([
      expect.objectContaining({
        scenarioId: "mobile-heal",
        op: "mobile.tap",
        stepPath: "steps[1].when",
        field: "locator",
        from: save,
        to: { by: "accessibilityId", value: "Save order" },
        strategy: "fallback",
        policy: "report",
      }),
    ]);
  });

  it("does not heal when the run turns healing off, and the step fails as before", async () => {
    const driver = new FakeDriver();
    driver.add("~Save order", new FakeElement());
    const { options } = mobileOptions(driver);
    const healable: ScenarioSpec = {
      id: "mobile-no-heal",
      type: "mobile",
      steps: [{ op: "mobile.tap", with: { locator: save, timeoutMs: 1000, fallbacks: [{ by: "accessibilityId", value: "Save order" }] } }],
    };
    const reporter = new RecordingReporter();
    await expect(runFromMetadata({ scenarios: [healable], mobile: { ...options, healing: "off" }, reporter })).rejects.toThrow("No element matches");
    expect(reporter.heals).toEqual({});
  });

  it("keeps one scenario's heals out of the next", async () => {
    const driver = new FakeDriver();
    driver.add("~Save order", new FakeElement());
    driver.add("~Save", new FakeElement());
    const { options } = mobileOptions(driver);
    const healing: ScenarioSpec = {
      id: "first",
      type: "mobile",
      steps: [{ op: "mobile.tap", with: { locator: { by: "accessibilityId", value: "Old" }, fallbacks: [{ by: "accessibilityId", value: "Save order" }] } }],
    };
    const plain: ScenarioSpec = { ...passing, id: "second" };
    const reporter = new RecordingReporter();
    await runFromMetadata({ scenarios: [healing, plain], mobile: options, reporter });
    expect(Object.keys(reporter.heals)).toEqual(["first"]);
  });

  it("shares one device session across scenarios", async () => {
    const driver = new FakeDriver();
    driver.add("~Save", new FakeElement());
    const { options, factory } = mobileOptions(driver);
    await runFromMetadata({ scenarios: [passing, { ...passing, id: "mobile-pass-2" }], mobile: options, reporter: new RecordingReporter() });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("on failure attaches the device log to the scenario, and the recording to the run, but no screenshot unless asked", async () => {
    const driver = new FakeDriver();
    // The first read happens when the scenario starts and drains older entries; the entry appears during the scenario.
    const reads: Array<Array<{ level: string; message: string }>> = [[], [{ level: "ALL", message: "10-09 09:49:37.434   363  3815 E AndroidRuntime: crash" }]];
    driver.getLogs = async () => reads.shift() ?? [];
    const { options } = mobileOptions(driver);
    const reporter = new RecordingReporter();

    await expect(runFromMetadata({ scenarios: [failing], mobile: options, reporter })).rejects.toThrow("No element matches");

    expect(reporter.scenarioEnds).toEqual([{ id: "mobile-fail", ok: false }]);
    expect(reporter.attachments).toEqual([{ scenarioId: "mobile-fail", name: "console.json" }]);
    expect(reporter.runArtifacts.map((a) => a.name)).toEqual(["run.mp4"]);
    expect(reporter.runEnd).toMatchObject({ ok: false, failed: 1 });
    expect(driver.callsTo("deleteSession")).toHaveLength(1);
  });

  it("fails before starting anything when a mobile scenario has no mobile options, and still reports run.end", async () => {
    const reporter = new RecordingReporter();
    await expect(runFromMetadata({ scenarios: [passing], reporter })).rejects.toThrow(
      'Scenario "mobile-pass" is a mobile scenario but the run has no mobile options (device and app). Start it from Test Hub, or pass RunnerOptions.mobile.',
    );
    expect(reporter.runEnd).toMatchObject({ ok: false });
    expect(reporter.scenarioEnds).toEqual([]);
  });

  it("rejects a ui op in a mobile scenario before starting a session", async () => {
    const driver = new FakeDriver();
    const { options, factory } = mobileOptions(driver);
    const mixedUp: ScenarioSpec = { id: "bad", type: "mobile", steps: [{ op: "ui.click", with: { selector: "#x" } }] };
    await expect(runFromMetadata({ scenarios: [mixedUp], mobile: options, reporter: new RecordingReporter() })).rejects.toThrow(
      'Scenario "bad" is a mobile scenario but uses "ui.click"',
    );
    expect(factory).not.toHaveBeenCalled();
  });

  it("never starts a mobile session for a run without mobile scenarios", async () => {
    const driver = new FakeDriver();
    const { options, factory } = mobileOptions(driver);
    const apiOnly: ScenarioSpec = { id: "api-only", type: "api", steps: [{ op: "util.log", with: { message: "hello" } }] };
    const reporter = new RecordingReporter();
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await runFromMetadata({ scenarios: [apiOnly], mobile: options, reporter });
    } finally {
      log.mockRestore();
    }
    expect(factory).not.toHaveBeenCalled();
    expect(reporter.runEnd).toMatchObject({ ok: true, passed: 1 });
  });
});

describe("mobile session modes and the reset scenario", () => {
  const tap = (name: string, over: Record<string, unknown> = {}) => ({
    and: { op: "mobile.tap", with: { locator: { by: "accessibilityId", value: name }, ...over } },
  });
  const launch = (clearData?: boolean) => ({ given: { op: "mobile.launch", with: clearData ? { clearData: true } : {} } });
  const scripts = (driver: FakeDriver) => driver.callsTo("execute").map((call) => String(call.args[0]));
  const clicks = (element: FakeElement) => element.calls.filter((call) => call === "click").length;

  const login: ScenarioSpec = { id: "login", type: "mobile", saveSession: true, steps: [launch(true), tap("Log in")] };
  const cart: ScenarioSpec = { id: "cart", type: "mobile", dependsOn: ["login"], session: "restore", steps: [tap("Cart")] };
  const unrelated: ScenarioSpec = { id: "unrelated", type: "mobile", steps: [tap("Other")] };

  function android() {
    const driver = new FakeDriver();
    const logIn = driver.add("~Log in", new FakeElement())[0];
    const inCart = driver.add("~Cart", new FakeElement())[0];
    driver.add("~Other", new FakeElement());
    return { driver, logIn, inCart, options: mobileOptions(driver).options, reporter: new RecordingReporter() };
  }

  it("restore right after its producer only relaunches: the login is not run twice", async () => {
    const { driver, logIn, inCart, options, reporter } = android();
    await runFromMetadata({ scenarios: [login, cart], mobile: options, reporter });
    expect(clicks(logIn)).toBe(1);
    expect(clicks(inCart)).toBe(1);
    expect(scripts(driver).filter((script) => script === "mobile: clearApp")).toHaveLength(1);
    expect(reporter.stepEnds.filter((e) => e.setup).map((e) => [e.scenarioId, e.setup, e.op])).toEqual([["cart", "restore", "mobile.launch"]]);
  });

  it("restore after another scenario touched the app clears it and logs in again, as setup of the scenario", async () => {
    const { driver, logIn, inCart, options, reporter } = android();
    await runFromMetadata({ scenarios: [login, unrelated, cart], mobile: options, reporter });
    expect(clicks(logIn)).toBe(2);
    expect(clicks(inCart)).toBe(1);
    // The login's own launch cleared the app once; the cold restore cleared it twice more (its start, then the login's launch).
    expect(scripts(driver).filter((script) => script === "mobile: clearApp")).toHaveLength(3);
    const setup = reporter.stepEnds.filter((e) => e.setup);
    expect(setup.map((e) => [e.scenarioId, e.setup, e.op])).toEqual([
      ["cart", "reset", "mobile.launch"],
      ["login", "restore", "mobile.launch"],
      ["login", "restore", "mobile.tap"],
    ]);
    // The login steps keep their own scenario id and path, so a heal in them can be applied to the login scenario.
    expect(setup[2]).toMatchObject({ scenarioId: "login", stepPath: "steps[1].and" });
    expect(reporter.runEnd).toMatchObject({ ok: true, total: 3, passed: 3 });
  });

  it("fresh on an emulator clears the app's data before the scenario", async () => {
    const { driver, options, reporter } = android();
    await runFromMetadata({ scenarios: [{ ...unrelated, session: "fresh" }], mobile: options, reporter });
    expect(scripts(driver)).toContain("mobile: clearApp");
  });

  describe("on a real iPhone", () => {
    const reset: ScenarioSpec = {
      id: "reset-app",
      type: "mobile",
      reset: true,
      steps: [launch(), tap("Log out", { optional: true, timeoutMs: 100 }), { then: { op: "mobile.expectVisible", with: { locator: { by: "accessibilityId", value: "login screen" } } } }],
    };
    const fresh: ScenarioSpec = { id: "fresh-start", type: "mobile", session: "fresh", steps: [tap("Next")] };

    function iphone() {
      const driver = new FakeDriver();
      driver.add("~Next", new FakeElement());
      driver.add("~login screen", new FakeElement());
      const { options } = mobileOptions(driver);
      return { driver, options: { ...options, platformName: "iOS" as const }, reporter: new RecordingReporter() };
    }

    it("resets through the reset scenario instead of clearing data, and does not count it as a scenario", async () => {
      const { driver, options, reporter } = iphone();
      await runFromMetadata({ scenarios: [reset, fresh], mobile: options, reporter });

      expect(scripts(driver).some((script) => /clearApp|removeApp|installApp/.test(script))).toBe(false);
      expect(reporter.scenarioEnds).toEqual([{ id: "fresh-start", ok: true }]);
      expect(reporter.runEnd).toMatchObject({ ok: true, total: 1, passed: 1 });
      const setup = reporter.stepEnds.filter((e) => e.setup);
      // The "Log out" button is not there in this state, so that optional step is skipped and the reset still passes.
      expect(setup.map((e) => [e.scenarioId, e.op, e.ok])).toEqual([
        ["fresh-start", "mobile.launch", true],
        ["reset-app", "mobile.launch", true],
        ["reset-app", "mobile.tap", true],
        ["reset-app", "mobile.expectVisible", true],
      ]);
    });

    it("taps the optional step when its element is there", async () => {
      const { driver, options, reporter } = iphone();
      const [logOut] = driver.add("~Log out", new FakeElement());
      await runFromMetadata({ scenarios: [reset, fresh], mobile: options, reporter });
      expect(clicks(logOut)).toBe(1);
    });

    it("fails the run before it starts, with what to add, when the file has no reset scenario", async () => {
      const { options, reporter } = iphone();
      await expect(runFromMetadata({ scenarios: [fresh], mobile: options, reporter })).rejects.toThrow(
        'Scenario "fresh-start" starts with a clean app, but there is no build to reinstall on this iOS device and the file has no reset scenario.',
      );
      expect(reporter.scenarioEnds).toEqual([]);
      expect(reporter.runEnd).toMatchObject({ ok: false });
    });

    it("names the reset scenario and the step when the reset itself fails", async () => {
      const { driver, options, reporter } = iphone();
      driver.elements.delete("~login screen");
      const broken: ScenarioSpec = { ...reset, steps: [launch(), { then: { op: "mobile.expectVisible", with: { locator: { by: "accessibilityId", value: "login screen" }, timeoutMs: 500 } } }] };
      await expect(runFromMetadata({ scenarios: [broken, fresh], mobile: options, reporter })).rejects.toThrow(
        'Setup "reset" (scenario "reset-app") failed at steps[1].then: No element matches',
      );
      expect(reporter.scenarioEnds).toEqual([{ id: "fresh-start", ok: false }]);
    });
  });

  it("runs a file that has none of the new fields exactly as before: no setup, one shared session", async () => {
    const { driver, options, reporter } = android();
    await runFromMetadata({ scenarios: [unrelated, { ...unrelated, id: "again" }], mobile: options, reporter });
    expect(reporter.stepEnds.filter((e) => e.setup)).toEqual([]);
    expect(scripts(driver)).toEqual([]);
  });
});

describe("optional mobile steps", () => {
  const optionalTap = (over: Record<string, unknown>): ScenarioSpec => ({
    id: "opt",
    type: "mobile",
    steps: [{ when: { op: "mobile.tap", with: { locator: { by: "accessibilityId", value: "Maybe" }, optional: true, ...over } } }],
  });

  it("passes without doing anything when the element is not there", async () => {
    const driver = new FakeDriver();
    const { options } = mobileOptions(driver);
    const reporter = new RecordingReporter();
    await runFromMetadata({ scenarios: [optionalTap({ timeoutMs: 100 })], mobile: options, reporter });
    expect(reporter.scenarioEnds).toEqual([{ id: "opt", ok: true }]);
  });

  it("taps the element when it is there", async () => {
    const driver = new FakeDriver();
    const [maybe] = driver.add("~Maybe", new FakeElement());
    await runFromMetadata({ scenarios: [optionalTap({})], mobile: mobileOptions(driver).options, reporter: new RecordingReporter() });
    expect(maybe.calls).toContain("click");
  });

  it("still fails on anything other than a missing element, such as a locator that is not valid", async () => {
    const driver = new FakeDriver();
    const { options } = mobileOptions(driver);
    await expect(
      runFromMetadata({ scenarios: [optionalTap({ locator: "Maybe" })], mobile: options, reporter: new RecordingReporter() }),
    ).rejects.toThrow("locator must be an object");
  });

  it("does not heal: an optional step looks only for its own locator", async () => {
    const driver = new FakeDriver();
    driver.add("~Other name", new FakeElement());
    const { options } = mobileOptions(driver);
    const reporter = new RecordingReporter();
    await runFromMetadata({
      scenarios: [optionalTap({ timeoutMs: 100, fallbacks: [{ by: "accessibilityId", value: "Other name" }] })],
      mobile: options,
      reporter,
    });
    expect(reporter.heals).toEqual({});
  });
});


describe("a restore that checks the app is still logged in before replaying the login", () => {
  const tap = (name: string) => ({ and: { op: "mobile.tap", with: { locator: { by: "accessibilityId", value: name } } } });
  const sees = (name: string) => ({ then: { op: "mobile.expectVisible", with: { locator: { by: "accessibilityId", value: name } } } });
  const launch = (clearData?: boolean) => ({ given: { op: "mobile.launch", with: clearData ? { clearData: true } : {} } });
  const scripts = (driver: FakeDriver) => driver.callsTo("execute").map((call) => String(call.args[0]));
  const clicks = (element: FakeElement) => element.calls.filter((call) => call === "click").length;
  const restores = (login: ScenarioSpec, id: string, steps: any[]): ScenarioSpec => ({
    id, type: "mobile", dependsOn: [login.id], session: "restore", steps,
  });

  const login = (clearData: boolean, check = true): ScenarioSpec => ({
    id: "login", type: "mobile", saveSession: true,
    steps: [launch(clearData), tap("Log in"), ...(check ? [sees("Channels")] : [])],
  });

  /** A fake app that shows Channels once logged in, and hides it again when "Log out" is tapped. */
  function app() {
    const driver = new FakeDriver();
    const channels = driver.add("~Channels", new FakeElement())[0];
    const logIn = driver.add("~Log in", new FakeElement())[0];
    const logOut = driver.add("~Log out", new FakeElement())[0];
    for (const name of ["Cart", "Saved", "Other"]) driver.add(`~${name}`, new FakeElement());
    channels.displayed = false; // nobody is logged in until the login scenario says so
    const press = logIn.click.bind(logIn);
    logIn.click = async () => { await press(); channels.displayed = true; };
    const out = logOut.click.bind(logOut);
    logOut.click = async () => { await out(); channels.displayed = false; };
    return { driver, logIn, channels, reporter: new RecordingReporter() };
  }
  /** The setup steps of a run, in order. Steps replayed from another scenario are reported under that scenario's id. */
  const setupOf = (reporter: RecordingReporter, scenarioId?: string) =>
    reporter.stepEnds.filter((e) => e.setup && (!scenarioId || e.scenarioId === scenarioId)).map((e) => [e.scenarioId, e.setup, e.op]);

  it("relaunches and carries on when the app is still logged in, so the login runs once", async () => {
    const { driver, logIn, reporter } = app();
    const scenarios = [login(true), restores(login(true), "cart", [launch(), tap("Cart")]), restores(login(true), "saved", [launch(), tap("Saved")])];
    await runFromMetadata({ scenarios, mobile: mobileOptions(driver).options, reporter });
    expect(clicks(logIn)).toBe(1);
    expect(scripts(driver).filter((script) => script === "mobile: clearApp")).toHaveLength(1);
    // The second restore found the channel list, so it is a relaunch and nothing more.
    expect(setupOf(reporter, "saved")).toEqual([["saved", "restore", "mobile.launch"]]);
    expect(reporter.runEnd).toMatchObject({ ok: true, total: 3, passed: 3 });
  });

  it("replays the login when an earlier scenario logged the app out", async () => {
    const { driver, logIn, reporter } = app();
    const scenarios = [
      login(true),
      restores(login(true), "log-out", [launch(), tap("Log out")]),
      restores(login(true), "saved", [launch(), tap("Saved")]),
    ];
    await runFromMetadata({ scenarios, mobile: mobileOptions(driver).options, reporter });
    expect(clicks(logIn)).toBe(2);
    // The log-out scenario only relaunched. Then "saved" relaunched, found no channel list, started the app from scratch and ran
    // the login's steps again, as before.
    expect(setupOf(reporter)).toEqual([
      ["log-out", "restore", "mobile.launch"],
      ["saved", "restore", "mobile.launch"],
      ["saved", "reset", "mobile.launch"],
      ["login", "restore", "mobile.launch"],
      ["login", "restore", "mobile.tap"],
      ["login", "restore", "mobile.expectVisible"],
    ]);
    expect(reporter.runEnd).toMatchObject({ ok: true, total: 3, passed: 3 });
  });

  it("does not look when the login ends on no check: it replays as it always did", async () => {
    const { driver, logIn, reporter } = app();
    const scenarios = [login(true, false), restores(login(true, false), "cart", [launch(), tap("Cart")]), restores(login(true, false), "saved", [launch(), tap("Saved")])];
    await runFromMetadata({ scenarios, mobile: mobileOptions(driver).options, reporter });
    expect(clicks(logIn)).toBe(2);
    expect(setupOf(reporter, "saved")[0]).toEqual(["saved", "reset", "mobile.launch"]);
  });

  it("does not trust the app after a scenario that starts fresh", async () => {
    const { driver, logIn, reporter } = app();
    const fresh: ScenarioSpec = { id: "fresh", type: "mobile", session: "fresh", steps: [launch(), tap("Other")] };
    const scenarios = [login(true), fresh, restores(login(true), "saved", [launch(), tap("Saved")])];
    await runFromMetadata({ scenarios, mobile: mobileOptions(driver).options, reporter });
    expect(clicks(logIn)).toBe(2);
    // No relaunch-and-look: it goes straight to the clean start and the login.
    expect(setupOf(reporter, "saved")[0]).toEqual(["saved", "reset", "mobile.launch"]);
  });

  describe("on a real iPhone", () => {
    const reset: ScenarioSpec = {
      id: "reset-app", type: "mobile", reset: true,
      steps: [launch(), tap("Log out"), sees("login screen")],
    };
    function iphone() {
      const made = app();
      made.driver.add("~login screen", new FakeElement()); // the signed-out screen the reset ends on
      const { options } = mobileOptions(made.driver);
      return { ...made, options: { ...options, platformName: "iOS" as const } };
    }
    const phoneLogin: ScenarioSpec = { id: "login", type: "mobile", saveSession: true, steps: [launch(), tap("Log in"), sees("Channels")] };

    it("skips both the reset scenario and the login when the app is still logged in", async () => {
      const { logIn, options, reporter } = iphone();
      const scenarios = [phoneLogin, restores(phoneLogin, "cart", [launch(), tap("Cart")]), restores(phoneLogin, "saved", [launch(), tap("Saved")]), reset];
      await runFromMetadata({ scenarios, mobile: options, reporter });
      expect(clicks(logIn)).toBe(1);
      expect(setupOf(reporter, "saved")).toEqual([["saved", "restore", "mobile.launch"]]);
    });

    it("runs the reset scenario and the login when it is not", async () => {
      const { logIn, options, reporter } = iphone();
      const scenarios = [
        phoneLogin,
        restores(phoneLogin, "log-out", [launch(), tap("Log out")]),
        restores(phoneLogin, "saved", [launch(), tap("Saved")]),
        reset,
      ];
      await runFromMetadata({ scenarios, mobile: options, reporter });
      expect(clicks(logIn)).toBeGreaterThanOrEqual(2);
      // Relaunch, no channel list, then the reset scenario brings the app back to its start before the login runs again.
      expect(setupOf(reporter).filter(([, kind]) => kind === "reset").map(([id]) => id)).toEqual(["saved", "reset-app", "reset-app", "reset-app"]);
      expect(reporter.runEnd).toMatchObject({ ok: true });
    });
  });
});

describe("clean starts on iOS with and without a build to reinstall", () => {
  const tap = (name: string) => ({ and: { op: "mobile.tap", with: { locator: { by: "accessibilityId", value: name } } } });
  const launch = (clearData?: boolean) => ({ given: { op: "mobile.launch", with: clearData ? { clearData: true } : {} } });
  const scripts = (driver: FakeDriver) => driver.callsTo("execute").map((call) => String(call.args[0]));
  const reinstalled = (driver: FakeDriver) => scripts(driver).some((script) => /removeApp|installApp/.test(script));
  const reset: ScenarioSpec = {
    id: "reset-app", type: "mobile", reset: true,
    steps: [launch(), tap("Log out"), { then: { op: "mobile.expectVisible", with: { locator: { by: "accessibilityId", value: "login screen" } } } }],
  };
  // Starts clean the plain way: no session field, just a clearData launch first.
  const startsClean: ScenarioSpec = { id: "starts-clean", type: "mobile", steps: [launch(true), tap("Next")] };

  function device(over: Partial<MobileAdapterOptions>) {
    const driver = new FakeDriver();
    driver.add("~Next", new FakeElement());
    driver.add("~Log out", new FakeElement());
    driver.add("~login screen", new FakeElement());
    const { options } = mobileOptions(driver);
    return { driver, options: { ...options, platformName: "iOS" as const, ...over }, reporter: new RecordingReporter() };
  }
  const phone = { simulator: false };
  const simulator = { simulator: true, udid: "1674E718-0EBA-4568-9644-F18E0DDF7705" };

  for (const [name, kind] of [["an iPhone", phone], ["a Simulator", simulator]] as const) {
    it(`${name} with no build starts a clean scenario through the reset scenario, and its first step only relaunches`, async () => {
      const { driver, options, reporter } = device({ ...kind, appPath: undefined });
      await runFromMetadata({ scenarios: [reset, startsClean], mobile: options, reporter });
      expect(reinstalled(driver)).toBe(false);
      expect(scripts(driver)).not.toContain("mobile: clearApp");
      expect(reporter.runEnd).toMatchObject({ ok: true, total: 1, passed: 1 });
      const setup = reporter.stepEnds.filter((e) => e.setup).map((e) => [e.scenarioId, e.op]);
      expect(setup).toEqual([
        ["starts-clean", "mobile.launch"], ["reset-app", "mobile.launch"], ["reset-app", "mobile.tap"], ["reset-app", "mobile.expectVisible"],
      ]);
    });

    it(`${name} with no build and no reset scenario fails before anything starts, naming the scenario`, async () => {
      const { driver, options, reporter } = device({ ...kind, appPath: undefined });
      await expect(runFromMetadata({ scenarios: [startsClean], mobile: options, reporter })).rejects.toThrow(
        'Scenario "starts-clean" starts with a clean app, but there is no build to reinstall on this iOS device and the file has no reset scenario.',
      );
      expect(scripts(driver)).toEqual([]);
      expect(reporter.runEnd).toMatchObject({ ok: false });
    });

    it(`${name} with no build refuses a clearData partway through, even with a reset scenario`, async () => {
      const { options, reporter } = device({ ...kind, appPath: undefined });
      const midway: ScenarioSpec = { id: "midway", type: "mobile", steps: [launch(), tap("Next"), { and: { op: "mobile.reset" } }] };
      await expect(runFromMetadata({ scenarios: [reset, midway], mobile: options, reporter })).rejects.toThrow(
        'Scenario "midway" clears the app\'s data partway through',
      );
    });

    it(`${name} with a build reinstalls it for a clean start and needs no reset scenario`, async () => {
      const { driver, options, reporter } = device({ ...kind, appPath: "/builds/MyApp.ipa", appSource: kind === phone ? "installed" : "upload" });
      await runFromMetadata({ scenarios: [startsClean], mobile: options, reporter });
      expect(scripts(driver)).toEqual(expect.arrayContaining(["mobile: removeApp", "mobile: installApp"]));
      expect(reporter.runEnd).toMatchObject({ ok: true, passed: 1 });
      expect(reporter.stepEnds.filter((e) => e.setup)).toEqual([]);
    });
  }

  it("Android keeps clearing an installed app in place, with no build and no reset scenario", async () => {
    const driver = new FakeDriver();
    driver.add("~Next", new FakeElement());
    const reporter = new RecordingReporter();
    await runFromMetadata({ scenarios: [startsClean], mobile: mobileOptions(driver).options, reporter });
    expect(scripts(driver)).toContain("mobile: clearApp");
    expect(reinstalled(driver)).toBe(false);
    expect(reporter.runEnd).toMatchObject({ ok: true, passed: 1 });
  });
});
