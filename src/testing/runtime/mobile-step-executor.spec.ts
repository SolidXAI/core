import { FakeClock, FakeDriver, FakeElement } from "../adapters/mobile/fake-driver";
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { CAPABILITIES, RUNTIME_VERSION, listOps } from "./index";
import { createMobileStepExecutor } from "./step-executor";
import type { MobileStepExecutorOptions } from "./step-executor";

const save = { by: "accessibilityId", value: "Save" };

function setup(overrides: Partial<MobileStepExecutorOptions> = {}) {
  const driver = new FakeDriver();
  // A clock that only moves when the adapter sleeps, so a missing element does not make a spec wait.
  const executor = createMobileStepExecutor({ driver, appPackage: "com.acme.app", appActivity: ".Main", defaultTimeoutMs: 2_000, clock: new FakeClock(), ...overrides });
  return { driver, executor };
}

describe("mobile step executor", () => {
  it("runs a step with the runner's handler and reports it", async () => {
    const { driver, executor } = setup();
    const [button] = driver.add("~Save", new FakeElement());
    const result = await executor.runStep({ op: "mobile.tap", with: { locator: save } }, { phase: "when", stepPath: "steps[1].when" });
    expect(result).toMatchObject({ ok: true, op: "mobile.tap", phase: "when", stepPath: "steps[1].when", heals: [] });
    expect(button.calls).toContain("click");
  });

  it("reports a failing step instead of throwing, with the runner's message", async () => {
    const { executor } = setup();
    const result = await executor.runStep({ op: "mobile.tap", with: { locator: save, timeoutMs: 1_000 } });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No element matches { by: "accessibilityId", value: "Save" } after 1000 ms');
  });

  it("interpolates secrets and shared resources the way the runner does", async () => {
    const { driver, executor } = setup({ secrets: { "demo-password": "s3cret" } });
    const [field] = driver.add("~Password input field", new FakeElement());
    const result = await executor.runStep({
      op: "mobile.type",
      with: { locator: { by: "accessibilityId", value: "Password input field" }, text: "${secret:demo-password}" },
    });
    expect(result.ok).toBe(true);
    expect(field.calls).toContain("setValue:s3cret");
  });

  it("heals only when asked to: an authoring session turns it off", async () => {
    const withFallback = { op: "mobile.tap", with: { locator: save, timeoutMs: 1_000, fallbacks: [{ by: "accessibilityId", value: "Save order" }] } };

    const reporting = setup({ healing: "report" });
    reporting.driver.add("~Save order", new FakeElement());
    const healed = await reporting.executor.runStep(withFallback);
    expect(healed.ok).toBe(true);
    expect(healed.heals).toMatchObject([{ field: "locator", from: save, to: { by: "accessibilityId", value: "Save order" } }]);

    const authoring = setup({ healing: "off" });
    authoring.driver.add("~Save order", new FakeElement());
    const strict = await authoring.executor.runStep(withFallback);
    expect(strict.ok).toBe(false);
    expect(strict.heals).toEqual([]);
  });

  it("runs a whole scenario through the engine, with a record of each step", async () => {
    const { driver, executor } = setup();
    driver.add("~Save", new FakeElement());
    driver.add("~Done", new FakeElement());
    const scenario: ScenarioSpec = {
      id: "demo",
      type: "mobile",
      steps: [
        { given: { op: "mobile.launch", with: { clearData: true } } },
        { when: { op: "mobile.tap", with: { locator: save } } },
        { then: { op: "mobile.expectVisible", with: { locator: { by: "accessibilityId", value: "Done" } } } },
      ],
    };
    const result = await executor.runScenario(scenario);
    expect(result.ok).toBe(true);
    expect(result.steps.map((s) => [s.op, s.ok, s.stepPath])).toEqual([
      ["mobile.launch", true, "steps[0].given"],
      ["mobile.tap", true, "steps[1].when"],
      ["mobile.expectVisible", true, "steps[2].then"],
    ]);
  });

  it("reports the failing step of a scenario, and heals it made along the way", async () => {
    const { driver, executor } = setup();
    driver.add("~Save order", new FakeElement());
    const scenario: ScenarioSpec = {
      id: "demo",
      type: "mobile",
      steps: [
        { when: { op: "mobile.tap", with: { locator: save, fallbacks: [{ by: "accessibilityId", value: "Save order" }] } } },
        { then: { op: "mobile.expectVisible", with: { locator: { by: "accessibilityId", value: "Nope" }, timeoutMs: 1_000 } } },
      ],
    };
    const result = await executor.runScenario(scenario);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No element matches");
    expect(result.steps.map((s) => s.ok)).toEqual([true, false]);
    expect(result.heals).toHaveLength(1);
  });

  it("never ends the caller's session", async () => {
    const { driver, executor } = setup();
    driver.add("~Save", new FakeElement());
    await executor.runStep({ op: "mobile.tap", with: { locator: save } });
    await executor.mobile.stop();
    expect(driver.callsTo("deleteSession")).toHaveLength(0);
  });

  it("is a mobile context: no browser, no api adapter needed by mobile steps", async () => {
    const { executor } = setup();
    expect(executor.context.scenarioType).toBe("mobile");
    expect(executor.context.ui).toBeUndefined();
    expect(executor.context.mobile).toBe(executor.mobile);
  });

  it("forgets saved values when asked", async () => {
    const { driver, executor } = setup();
    driver.add("~Save", new FakeElement({ text: "hello" }));
    await executor.runStep({ op: "mobile.getText", saveAs: "label", with: { locator: save } });
    expect(executor.context.resources.has("label")).toBe(true);
    executor.resetResources();
    expect(executor.context.resources.has("label")).toBe(false);
  });
});

describe("clearing an iOS app's data", () => {
  const launch = { op: "mobile.launch", with: { clearData: true, grantPermissions: false } };
  const scripts = (driver: FakeDriver) => driver.callsTo("execute").map((call) => [call.args[0], call.args[1]]);

  it("reinstalls the build it was given", async () => {
    const { driver, executor } = setup({ platformName: "iOS", simulator: true, appPath: "/builds/My Demo App.app" });
    const result = await executor.runStep(launch);
    expect(result.ok).toBe(true);
    expect(scripts(driver)).toEqual(
      expect.arrayContaining([
        ["mobile: removeApp", { bundleId: "com.acme.app" }],
        ["mobile: installApp", { app: "/builds/My Demo App.app" }],
      ]),
    );
  });

  it("says what is missing when it was given no build", async () => {
    const { driver, executor } = setup({ platformName: "iOS", simulator: true });
    const result = await executor.runStep(launch);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Clearing data needs a build to reinstall");
    expect(scripts(driver).map(([script]) => script)).not.toContain("mobile: removeApp");
  });

  it("does not need a build on Android, which clears the data in place", async () => {
    const { driver, executor } = setup();
    expect((await executor.runStep({ op: "mobile.launch", with: { clearData: true } })).ok).toBe(true);
    expect(scripts(driver).map(([script]) => script)).toContain("mobile: clearApp");
  });
});

describe("runtime manifest", () => {
  it("lists every mobile op and the mobile capabilities", () => {
    expect(listOps().filter((op) => op.startsWith("mobile."))).toEqual([
      "mobile.back",
      "mobile.clear",
      "mobile.expectHidden",
      "mobile.expectText",
      "mobile.expectVisible",
      "mobile.getText",
      "mobile.hideKeyboard",
      "mobile.launch",
      "mobile.reset",
      "mobile.scrollTo",
      "mobile.submit",
      "mobile.swipe",
      "mobile.tap",
      "mobile.terminate",
      "mobile.type",
    ]);
    expect(CAPABILITIES).toEqual(expect.arrayContaining(["mobileRuntime", "mobileSelfHealing", "mobileSessionModes", "mobileReset"]));
    expect(RUNTIME_VERSION).toBe("1.3.0");
  });
});
