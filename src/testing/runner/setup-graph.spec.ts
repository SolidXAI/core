import type { ScenarioSpec, SetupSpec } from "../contracts/testing-metadata.types";
import { setupChain, setupHash, validateIndependent } from "./setup-graph";

const GOTO = { given: { op: "ui.goto", with: { url: "/" } } };
const CLICK = { when: { op: "ui.click", with: { selector: "button" } } };

function scn(id: string, extra: Partial<ScenarioSpec> = {}): ScenarioSpec {
  return { id, type: "ui", steps: [GOTO], ...extra } as ScenarioSpec;
}

function setup(id: string, extra: Partial<SetupSpec> = {}): SetupSpec {
  return { id, name: id, type: "ui", steps: [GOTO], ready: [GOTO], ...extra } as SetupSpec;
}

function byIdOf(setups: SetupSpec[]): Map<string, SetupSpec> {
  return new Map(setups.map((s) => [s.id, s]));
}

describe("validateIndependent", () => {
  it("reports no errors for a valid chain auth-default -> project-exists", () => {
    const setups = [setup("auth-default"), setup("project-exists", { from: "auth-default" })];
    const scenarios = [scn("create-project", { restoreFrom: "project-exists" }), scn("sign-in", { restoreFrom: { setup: "auth-default", fresh: true } })];
    const result = validateIndependent(scenarios, setups);
    expect([...result.setupErrors]).toEqual([]);
    expect([...result.scenarioErrors]).toEqual([]);
  });

  it("accepts a setup without scope, and a setup that still has scope (it is ignored)", () => {
    const result = validateIndependent(
      [scn("a", { restoreFrom: "old-setup" }), scn("b", { restoreFrom: "auth-default" })],
      [setup("old-setup", { scope: "scenario" }), setup("auth-default")],
    );
    expect([...result.setupErrors]).toEqual([]);
    expect([...result.scenarioErrors]).toEqual([]);
  });

  it("skips mobile scenarios", () => {
    const mobile = scn("mobile-login", { type: "mobile", session: "shared", saveSession: true, steps: [CLICK] });
    const result = validateIndependent([mobile], []);
    expect(result.scenarioErrors.size).toBe(0);
  });

  it("flags a setup id shared with another setup", () => {
    const result = validateIndependent([], [setup("auth-default"), setup("auth-default")]);
    expect(result.setupErrors.get("auth-default")).toBe('Setup "auth-default" has the same id as another scenario or setup');
  });

  it("flags a setup id shared with a scenario", () => {
    const result = validateIndependent([scn("auth-default")], [setup("auth-default")]);
    expect(result.setupErrors.get("auth-default")).toBe('Setup "auth-default" has the same id as another scenario or setup');
  });

  it("flags a from that names an unknown setup", () => {
    const result = validateIndependent([], [setup("project-exists", { from: "ghost" })]);
    expect(result.setupErrors.get("project-exists")).toBe('Setup "project-exists" builds on unknown setup "ghost"');
  });

  it("flags every member of a from cycle", () => {
    const result = validateIndependent([], [setup("a", { from: "b" }), setup("b", { from: "a" })]);
    expect(result.setupErrors.get("a")).toBe('Setup "a" is part of a from cycle: a → b → a');
    expect(result.setupErrors.get("b")).toBe('Setup "b" is part of a from cycle: b → a → b');
  });

  it("flags a ui or mixed setup with no ready steps", () => {
    const result = validateIndependent([], [setup("auth-default", { ready: undefined }), setup("mixed-one", { type: "mixed", ready: [] })]);
    expect(result.setupErrors.get("auth-default")).toBe('Setup "auth-default" needs ready steps (ui and mixed setups)');
    expect(result.setupErrors.get("mixed-one")).toBe('Setup "mixed-one" needs ready steps (ui and mixed setups)');
  });

  it("flags a ready list whose first step is not ui.goto", () => {
    const result = validateIndependent([], [setup("auth-default", { ready: [CLICK] })]);
    expect(result.setupErrors.get("auth-default")).toBe('Setup "auth-default": the first ready step must be ui.goto');
  });

  it("flags a child whose parent is invalid", () => {
    const result = validateIndependent([], [setup("auth-default", { ready: undefined }), setup("project-exists", { from: "auth-default" })]);
    expect(result.setupErrors.get("project-exists")).toBe('Setup "project-exists": its parent "auth-default" is invalid');
  });

  it("flags a scenario session of shared or restore, and allows fresh", () => {
    const result = validateIndependent(
      [scn("a", { session: "shared" }), scn("b", { session: "restore" }), scn("c", { session: "fresh" })],
      [],
    );
    expect(result.scenarioErrors.get("a")).toBe('Scenario "a": session "shared" is not allowed for ui and api scenarios; run the migration');
    expect(result.scenarioErrors.get("b")).toBe('Scenario "b": session "restore" is not allowed for ui and api scenarios; run the migration');
    expect(result.scenarioErrors.has("c")).toBe(false);
  });

  it("flags saveSession", () => {
    const result = validateIndependent([scn("a", { saveSession: true })], []);
    expect(result.scenarioErrors.get("a")).toBe('Scenario "a": saveSession is not allowed for ui and api scenarios; run the migration');
  });

  it("allows saveSession: false (it saves nothing)", () => {
    const result = validateIndependent([scn("a", { saveSession: false })], []);
    expect(result.scenarioErrors.has("a")).toBe(false);
  });

  it("flags a malformed restoreFrom", () => {
    const result = validateIndependent([scn("a", { restoreFrom: { setup: "" } as any })], []);
    expect(result.scenarioErrors.get("a")).toBe('Scenario "a": restoreFrom must be a setup id or { setup, fresh }');
  });

  it("flags a restoreFrom that names a scenario", () => {
    const result = validateIndependent([scn("a", { restoreFrom: "b" }), scn("b")], []);
    expect(result.scenarioErrors.get("a")).toBe('Scenario "a": restoreFrom must name a setup; run the migration ("b" is a scenario)');
  });

  it("flags a restoreFrom that names an unknown setup", () => {
    const result = validateIndependent([scn("a", { restoreFrom: "ghost" })], []);
    expect(result.scenarioErrors.get("a")).toBe('Scenario "a": restoreFrom names unknown setup "ghost"');
  });

  it("flags a restoreFrom that names a setup with a setup error", () => {
    const result = validateIndependent([scn("a", { restoreFrom: "auth-default" })], [setup("auth-default", { ready: [] })]);
    expect(result.scenarioErrors.get("a")).toBe(
      'Scenario "a": its setup "auth-default" is invalid: Setup "auth-default" needs ready steps (ui and mixed setups)',
    );
  });

  it("flags a dependsOn that names an unknown scenario", () => {
    const result = validateIndependent([scn("a", { dependsOn: ["ghost"] })], []);
    expect(result.scenarioErrors.get("a")).toBe('Scenario "a" depends on unknown scenario "ghost"');
  });

  it("flags every member of a dependsOn cycle", () => {
    const result = validateIndependent([scn("a", { dependsOn: ["b"] }), scn("b", { dependsOn: ["a"] })], []);
    expect(result.scenarioErrors.get("a")).toBe('Scenario "a" is part of a dependsOn cycle: a → b → a');
    expect(result.scenarioErrors.get("b")).toBe('Scenario "b" is part of a dependsOn cycle: b → a → b');
  });

  it("flags a ui or mixed scenario whose first step is not ui.goto", () => {
    const result = validateIndependent([scn("a", { steps: [CLICK] }), scn("b", { type: "mixed", steps: [CLICK] })], []);
    expect(result.scenarioErrors.get("a")).toBe('Scenario "a": the first ui step must be ui.goto');
    expect(result.scenarioErrors.get("b")).toBe('Scenario "b": the first ui step must be ui.goto');
  });

  it("checks the first ui step, not the first step, of a mixed or ui scenario", () => {
    const API = { given: { op: "api.post", with: { path: "/projects" } } };
    const UTIL = { given: { op: "util.wait", with: { ms: 1 } } };
    const result = validateIndependent(
      [
        scn("a", { type: "mixed", steps: [API, GOTO, CLICK] }),
        scn("b", { type: "mixed", steps: [API, CLICK] }),
        scn("c", { steps: [UTIL, GOTO] }),
        scn("d", { type: "mixed", steps: [API] }),
      ],
      [],
    );
    expect(result.scenarioErrors.has("a")).toBe(false);
    expect(result.scenarioErrors.get("b")).toBe('Scenario "b": the first ui step must be ui.goto');
    expect(result.scenarioErrors.has("c")).toBe(false);
    expect(result.scenarioErrors.has("d")).toBe(false);
  });

  it("never reports errors for mobile scenarios, even with a scenario restoreFrom, bad dependsOn or no goto", () => {
    const result = validateIndependent(
      [
        scn("m1", { type: "mobile", steps: [CLICK], restoreFrom: "m2", dependsOn: ["m2"] } as any),
        scn("m2", { type: "mobile", steps: [CLICK], dependsOn: ["m1"], session: "restore" }),
      ],
      [],
    );
    expect(result.scenarioErrors.size).toBe(0);
  });
});

describe("setupChain", () => {
  it("returns the root first and ends with the setup itself", () => {
    const byId = byIdOf([setup("auth-default"), setup("project-exists", { from: "auth-default" })]);
    expect(setupChain("project-exists", byId)).toEqual(["auth-default", "project-exists"]);
  });

  it("terminates on a from cycle", () => {
    const byId = byIdOf([setup("a", { from: "b" }), setup("b", { from: "a" })]);
    expect(setupChain("a", byId)).toEqual(["b", "a"]);
  });
});

describe("setupHash", () => {
  it("changes when a parent's steps change", () => {
    const before = byIdOf([setup("auth-default"), setup("project-exists", { from: "auth-default" })]);
    const after = byIdOf([
      setup("auth-default", { steps: [GOTO, CLICK] }),
      setup("project-exists", { from: "auth-default" }),
    ]);
    expect(setupHash("project-exists", before)).not.toBe(setupHash("project-exists", after));
  });

  it("is the same with and without the deprecated scope", () => {
    const without = byIdOf([setup("auth-default"), setup("project-exists", { from: "auth-default" })]);
    const withRun = byIdOf([setup("auth-default", { scope: "run" }), setup("project-exists", { from: "auth-default", scope: "run" })]);
    const withScenario = byIdOf([setup("auth-default", { scope: "scenario" }), setup("project-exists", { from: "auth-default", scope: "scenario" })]);
    expect(setupHash("project-exists", withRun)).toBe(setupHash("project-exists", without));
    expect(setupHash("project-exists", withScenario)).toBe(setupHash("project-exists", without));
  });

  it("changes when a nested value in the setup itself changes", () => {
    const before = byIdOf([setup("auth-default")]);
    const after = byIdOf([setup("auth-default", { steps: [{ given: { op: "ui.goto", with: { url: "/login" } } }] })]);
    expect(setupHash("auth-default", before)).not.toBe(setupHash("auth-default", after));
  });

  it("does not depend on key order", () => {
    const a = byIdOf([setup("auth-default", { name: "Signed in" })]);
    const b = byIdOf([{ name: "Signed in", ready: [GOTO], steps: [GOTO], type: "ui", id: "auth-default" } as SetupSpec]);
    expect(setupHash("auth-default", a)).toBe(setupHash("auth-default", b));
  });

  it("does not depend on nested key order", () => {
    const a = byIdOf([setup("x", { steps: [{ given: { op: "ui.goto", with: { url: "/", timeout: 5 } } }] })]);
    const b = byIdOf([setup("x", { steps: [{ given: { with: { timeout: 5, url: "/" }, op: "ui.goto" } }] })]);
    expect(setupHash("x", a)).toBe(setupHash("x", b));
  });
});
