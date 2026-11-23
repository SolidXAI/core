import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { orderForRun } from "./run-order";

function scn(id: string, extra: Partial<ScenarioSpec> = {}): ScenarioSpec {
  return { id, type: "ui", steps: [], ...extra };
}

const ids = (list: ScenarioSpec[]) => list.map((s) => s.id);

const sixScenarios = ["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => scn(id));

describe("orderForRun", () => {
  it("keeps the given order for file order and returns no seed", () => {
    const result = orderForRun(sixScenarios, { order: "file" });
    expect(ids(result.ordered)).toEqual(ids(sixScenarios));
    expect(result.order).toBe("file");
    expect(result.shuffleSeed).toBeUndefined();
  });

  it("moves an in-run gate target ahead of its dependent in file order", () => {
    const scenarios = [scn("b", { dependsOn: ["a"] }), scn("c"), scn("a"), scn("d")];
    expect(ids(orderForRun(scenarios, { order: "file" }).ordered)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps scenarios that share an id", () => {
    const scenarios = [scn("a"), scn("a"), scn("b", { dependsOn: ["a"] })];
    for (const order of ["file", "shuffle"] as const) {
      expect(orderForRun(scenarios, { order, shuffleSeed: "dup" }).ordered).toHaveLength(3);
    }
  });

  it("defaults to file order", () => {
    const result = orderForRun(sixScenarios, {});
    expect(ids(result.ordered)).toEqual(ids(sixScenarios));
    expect(result.order).toBe("file");
  });

  it("gives the same order for the same seed and input", () => {
    const first = orderForRun(sixScenarios, { order: "shuffle", shuffleSeed: "seed-42" });
    const second = orderForRun(sixScenarios, { order: "shuffle", shuffleSeed: "seed-42" });
    expect(ids(first.ordered)).toEqual(ids(second.ordered));
    expect(first.order).toBe("shuffle");
    expect(first.shuffleSeed).toBe("seed-42");
  });

  it("gives different orders for different seeds with 6 or more scenarios", () => {
    const orders = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((seed) =>
        ids(orderForRun(sixScenarios, { order: "shuffle", shuffleSeed: seed }).ordered).join(","),
      ),
    );
    expect(orders.size).toBeGreaterThan(4);
  });

  it("does not change the caller's array", () => {
    const input = [...sixScenarios];
    orderForRun(input, { order: "shuffle", shuffleSeed: "x" });
    expect(ids(input)).toEqual(ids(sixScenarios));
  });

  it("generates and returns a seed when shuffling without one", () => {
    const result = orderForRun(sixScenarios, { order: "shuffle" });
    expect(result.shuffleSeed).toMatch(/^[0-9a-f]{8}$/);
    expect(ids(result.ordered).sort()).toEqual(ids(sixScenarios).sort());
  });

  it("puts a gate target before its dependent over 20 seeds", () => {
    const scenarios = [
      scn("a"),
      scn("b", { dependsOn: ["a"] }),
      scn("c"),
      scn("d", { dependsOn: ["c", "b"] }),
      scn("e"),
      scn("f", { dependsOn: ["e"] }),
    ];
    for (let i = 0; i < 20; i++) {
      const { ordered } = orderForRun(scenarios, { order: "shuffle", shuffleSeed: `gate-${i}` });
      const position = (id: string) => ordered.findIndex((s) => s.id === id);
      expect(ordered).toHaveLength(scenarios.length);
      expect(position("a")).toBeLessThan(position("b"));
      expect(position("b")).toBeLessThan(position("d"));
      expect(position("c")).toBeLessThan(position("d"));
      expect(position("e")).toBeLessThan(position("f"));
    }
  });

  it("ignores a dependsOn target that is not in the selection", () => {
    const selected = [scn("b", { dependsOn: ["a"] }), scn("c")];
    const result = orderForRun(selected, { order: "shuffle", shuffleSeed: "outside" });
    expect(ids(result.ordered).sort()).toEqual(["b", "c"]);
  });

  it("keeps every scenario exactly once when there is a dependsOn cycle", () => {
    const scenarios = [scn("a", { dependsOn: ["b"] }), scn("b", { dependsOn: ["a"] }), scn("c", { dependsOn: ["a"] })];
    for (const order of ["file", "shuffle"] as const) {
      for (let i = 0; i < 20; i++) {
        const result = orderForRun(scenarios, { order, shuffleSeed: `cycle-${i}` });
        expect(ids(result.ordered).sort()).toEqual(["a", "b", "c"]);
        expect(ids(result.ordered).indexOf("a")).toBeLessThan(ids(result.ordered).indexOf("c"));
      }
    }
  });
});
