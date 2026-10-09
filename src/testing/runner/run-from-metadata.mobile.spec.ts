import { FakeDriver, FakeElement } from "../adapters/mobile/fake-driver";
import type { MobileAdapterOptions } from "../adapters/mobile/mobile.types";
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import type { Reporter } from "../reporter/reporter.types";
import { runFromMetadata } from "./run-from-metadata";

class RecordingReporter implements Reporter {
  scenarioEnds: Array<{ id: string; ok: boolean }> = [];
  attachments: Array<{ scenarioId: string; name: string }> = [];
  runArtifacts: string[] = [];
  runEnd?: { ok: boolean; passed: number; failed: number };
  onScenarioStart() {}
  onScenarioEnd(scenario: ScenarioSpec, result: { ok: boolean }) { this.scenarioEnds.push({ id: scenario.id, ok: result.ok }); }
  onStepStart() {}
  onStepEnd() {}
  attach(args: { scenarioId: string; name: string }) { this.attachments.push({ scenarioId: args.scenarioId, name: args.name }); }
  attachRunArtifact(args: { name: string }) { this.runArtifacts.push(args.name); }
  onRunEnd(args: { ok: boolean; passed: number; failed: number }) { this.runEnd = args; }
}

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

  it("shares one device session across scenarios", async () => {
    const driver = new FakeDriver();
    driver.add("~Save", new FakeElement());
    const { options, factory } = mobileOptions(driver);
    await runFromMetadata({ scenarios: [passing, { ...passing, id: "mobile-pass-2" }], mobile: options, reporter: new RecordingReporter() });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("on failure attaches the device log and a screenshot to the scenario, and the recording to the run", async () => {
    const driver = new FakeDriver();
    // The first read happens when the scenario starts and drains older entries; the entry appears during the scenario.
    const reads: Array<Array<{ level: string; message: string }>> = [[], [{ level: "ALL", message: "10-09 09:49:37.434   363  3815 E AndroidRuntime: crash" }]];
    driver.getLogs = async () => reads.shift() ?? [];
    const { options } = mobileOptions(driver);
    const reporter = new RecordingReporter();

    await expect(runFromMetadata({ scenarios: [failing], mobile: options, reporter })).rejects.toThrow("No element matches");

    expect(reporter.scenarioEnds).toEqual([{ id: "mobile-fail", ok: false }]);
    expect(reporter.attachments).toEqual([
      { scenarioId: "mobile-fail", name: "console.json" },
      { scenarioId: "mobile-fail", name: "screenshot.png" },
    ]);
    expect(reporter.runArtifacts).toEqual(["run.mp4"]);
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
