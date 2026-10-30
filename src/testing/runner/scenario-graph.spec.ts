import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import {
  expandWithDependencies,
  orderByDependencies,
  sessionSourceFor,
  usesDependencies,
  validateSessions,
} from "./scenario-graph";

function scn(id: string, extra: Partial<ScenarioSpec> = {}): ScenarioSpec {
  return { id, type: "ui", steps: [], ...extra };
}

describe("scenario dependency graph", () => {
  it("is inactive for files that use none of the new fields", () => {
    expect(usesDependencies([scn("a"), scn("b", { session: "shared" })])).toBe(false);
    expect(usesDependencies([scn("a", { dependsOn: ["b"] }), scn("b")])).toBe(true);
    expect(usesDependencies([scn("a", { saveSession: true })])).toBe(true);
  });

  it("pulls transitive dependencies into a selection, in file order", () => {
    const all = [scn("login", { saveSession: true }), scn("create", { dependsOn: ["login"] }), scn("edit", { dependsOn: ["create"] }), scn("other")];
    const picked = expandWithDependencies(all, [all[2]]);
    expect(picked.map((s) => s.id)).toEqual(["login", "create", "edit"]);
  });

  it("rejects a dependency that does not exist", () => {
    const all = [scn("a", { dependsOn: ["ghost"] })];
    expect(() => expandWithDependencies(all, all)).toThrow(/unknown scenario "ghost"/);
  });

  it("orders dependencies first and otherwise keeps file order", () => {
    const ordered = orderByDependencies([scn("b", { dependsOn: ["a"] }), scn("c"), scn("a")]);
    expect(ordered.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("names the scenarios in a cycle", () => {
    expect(() => orderByDependencies([scn("a", { dependsOn: ["b"] }), scn("b", { dependsOn: ["a"] })])).toThrow(
      /cycle: a → b → a/,
    );
  });

  it("restores from the nearest dependency that saved a session", () => {
    const list = [
      scn("login", { saveSession: true }),
      scn("admin", { dependsOn: ["login"] }),
      scn("report", { dependsOn: ["admin"], session: "restore" }),
    ];
    const byId = new Map(list.map((s) => [s.id, s]));
    expect(sessionSourceFor(list[2], byId)).toBe("login");
    expect(() => validateSessions(list)).not.toThrow();
  });

  it("rejects restore without a saved session and unknown session modes", () => {
    expect(() => validateSessions([scn("a"), scn("b", { dependsOn: ["a"], session: "restore" })])).toThrow(
      /none of its dependencies sets saveSession/,
    );
    expect(() => validateSessions([scn("a", { session: "bogus" as any })])).toThrow(/invalid session/);
  });
});
