import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { mobileScenarioProblem, scenarioNeedsMobile, scenarioNeedsUi } from "./lifecycle";

const scenario = (type: ScenarioSpec["type"], steps: ScenarioSpec["steps"]): ScenarioSpec => ({ id: "s1", type, steps });

describe("scenarioNeedsMobile", () => {
  it("is true for a mobile scenario, even with no steps", () => {
    expect(scenarioNeedsMobile(scenario("mobile", []))).toBe(true);
  });

  it("is true when any step, in any block shape, is a mobile op", () => {
    expect(scenarioNeedsMobile(scenario("mixed", [{ op: "util.log" }, { given: { op: "mobile.launch" } }]))).toBe(true);
    expect(scenarioNeedsMobile(scenario("api", [{ then: [{ op: "assert.equals" }, { op: "mobile.expectVisible" }] }]))).toBe(true);
    expect(scenarioNeedsMobile(scenario("api", [{ and: { op: "mobile.tap" } }]))).toBe(true);
  });

  it("is false for api and ui scenarios", () => {
    expect(scenarioNeedsMobile(scenario("api", [{ op: "api.request" }]))).toBe(false);
    expect(scenarioNeedsMobile(scenario("ui", [{ op: "ui.goto" }]))).toBe(false);
  });

  it("does not make a mobile scenario need a browser", () => {
    expect(scenarioNeedsUi(scenario("mobile", [{ op: "mobile.tap" }]))).toBe(false);
  });
});

describe("mobileScenarioProblem", () => {
  it("flags a ui op inside a mobile scenario", () => {
    expect(mobileScenarioProblem(scenario("mobile", [{ when: { op: "ui.click" } }]))).toBe(
      'Scenario "s1" is a mobile scenario but uses "ui.click". ui.* steps are not allowed in a mobile scenario; use mobile.* steps',
    );
  });

  it("allows api and assert ops next to mobile ops", () => {
    expect(mobileScenarioProblem(scenario("mobile", [{ op: "mobile.tap" }, { op: "api.request" }, { op: "assert.equals" }]))).toBeUndefined();
  });

  it("does not look at non-mobile scenarios", () => {
    expect(mobileScenarioProblem(scenario("ui", [{ op: "ui.click" }]))).toBeUndefined();
  });
});
