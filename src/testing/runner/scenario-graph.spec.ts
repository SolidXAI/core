import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import {
  expandRestoreFrom,
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

  describe("restoreFrom", () => {
    it("means dependsOn + session restore, and saves the source's session without saveSession", () => {
      const [login, cart] = expandRestoreFrom([scn("login"), scn("cart", { restoreFrom: "login" })]);
      expect(login.saveSession).toBe(true);
      expect(cart).toMatchObject({ dependsOn: ["login"], session: "restore", restoreFrom: "login" });
      const byId = new Map([login, cart].map((s) => [s.id, s]));
      expect(sessionSourceFor(cart, byId)).toBe("login");
      expect(() => validateSessions([login, cart])).not.toThrow();
      expect(usesDependencies([login, cart])).toBe(true);
    });

    it("puts the source first in dependsOn, keeps the others, and does not list it twice", () => {
      const list = expandRestoreFrom([
        scn("login"),
        scn("create"),
        scn("a", { restoreFrom: "login", dependsOn: ["create"] }),
        scn("b", { restoreFrom: "login", dependsOn: ["create", "login"] }),
      ]);
      expect(list[2].dependsOn).toEqual(["login", "create"]);
      expect(list[3].dependsOn).toEqual(["create", "login"]);
    });

    it("restores the named session, not the nearest one, when two are reachable", () => {
      const list = expandRestoreFrom([
        scn("login-admin"),
        scn("login-user"),
        scn("approve", { restoreFrom: "login-admin", dependsOn: ["login-user"] }),
        scn("view", { restoreFrom: "login-user", dependsOn: ["login-admin", "approve"] }),
      ]);
      const byId = new Map(list.map((s) => [s.id, s]));
      expect(sessionSourceFor(byId.get("approve")!, byId)).toBe("login-admin");
      expect(sessionSourceFor(byId.get("view")!, byId)).toBe("login-user");
    });

    it("pulls the source in past a selection that excludes it, and orders it first", () => {
      const all = expandRestoreFrom([scn("cart", { restoreFrom: "login" }), scn("login")]);
      const selected = expandWithDependencies(all, [all[0]]);
      expect(orderByDependencies(selected).map((s) => s.id)).toEqual(["login", "cart"]);
    });

    it("leaves a file without it untouched, and does not modify its input", () => {
      const plain = [scn("a"), scn("b", { dependsOn: ["a"] })];
      expect(expandRestoreFrom(plain)).toEqual(plain);
      const input = [scn("login"), scn("cart", { restoreFrom: "login" })];
      expandRestoreFrom(input);
      expect(input[0].saveSession).toBeUndefined();
      expect(input[1].dependsOn).toBeUndefined();
    });

    it("rejects a missing source, itself, the reset scenario and a different session mode", () => {
      expect(() => expandRestoreFrom([scn("cart", { restoreFrom: "nope" })])).toThrow(/unknown scenario "nope"/);
      expect(() => expandRestoreFrom([scn("cart", { restoreFrom: "cart" })])).toThrow(/cannot restoreFrom itself/);
      expect(() => expandRestoreFrom([scn("cart", { restoreFrom: "reset-app" })], "reset-app")).toThrow(/reset scenario/);
      expect(() => expandRestoreFrom([scn("login"), scn("cart", { restoreFrom: "login", session: "fresh" })])).toThrow(
        /means session "restore"/,
      );
      expect(() => expandRestoreFrom([scn("login"), scn("cart", { restoreFrom: "" })])).toThrow(/invalid restoreFrom/);
      expect(() => expandRestoreFrom([scn("login"), scn("cart", { restoreFrom: "login", session: "restore" })])).not.toThrow();
    });
  });
});
