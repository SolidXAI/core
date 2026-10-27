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
    expect(reporter.stepEnds).toEqual([
      { op: "mobile.launch", slowestCallMs: 31_000 },
      { op: "mobile.tap", slowestCallMs: undefined },
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
