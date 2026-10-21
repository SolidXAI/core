// Purpose: a run stops at the first failed scenario by default; failFast: false runs every
// scenario and still reports the run as failed.

import type { Reporter } from "../reporter/reporter.types";
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { runFromMetadata } from "./run-from-metadata";

function scenario(id: string, passes: boolean): ScenarioSpec {
  return {
    id,
    type: "api",
    steps: [{ op: "assert.equals", with: { actual: 1, expected: passes ? 1 : 2 } }],
  };
}

function recorder() {
  const ended: Array<{ id: string; ok: boolean }> = [];
  let runEnd: Parameters<NonNullable<Reporter["onRunEnd"]>>[0] | undefined;
  const reporter: Reporter = {
    onScenarioStart: () => undefined,
    onScenarioEnd: (s, r) => {
      ended.push({ id: s.id, ok: r.ok });
    },
    onStepStart: () => undefined,
    onStepEnd: () => undefined,
    onRunEnd: (r) => {
      runEnd = r;
    },
  };
  return { reporter, ended, getRunEnd: () => runEnd };
}

describe("runFromMetadata: failFast", () => {
  const scenarios = [scenario("a", true), scenario("b", false), scenario("c", true)];

  it("stops at the first failed scenario by default", async () => {
    const { reporter, ended, getRunEnd } = recorder();

    await expect(runFromMetadata({ scenarios, reporter })).rejects.toThrow();

    expect(ended.map((e) => e.id)).toEqual(["a", "b"]);
    expect(getRunEnd()).toMatchObject({ ok: false, total: 3, passed: 1, failed: 1 });
  });

  it("stops at the first failed scenario when failFast is true", async () => {
    const { reporter, ended } = recorder();

    await expect(runFromMetadata({ scenarios, reporter, failFast: true })).rejects.toThrow();

    expect(ended.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("runs every scenario when failFast is false, then still fails the run", async () => {
    const { reporter, ended, getRunEnd } = recorder();

    await expect(runFromMetadata({ scenarios, reporter, failFast: false })).rejects.toThrow();

    expect(ended).toEqual([
      { id: "a", ok: true },
      { id: "b", ok: false },
      { id: "c", ok: true },
    ]);
    expect(getRunEnd()).toMatchObject({ ok: false, total: 3, passed: 2, failed: 1 });
  });

  it("rethrows the first failure when several scenarios fail", async () => {
    const { reporter, getRunEnd } = recorder();
    const many = [scenario("a", false), scenario("b", true), scenario("c", false)];

    await expect(runFromMetadata({ scenarios: many, reporter, failFast: false })).rejects.toThrow();

    expect(getRunEnd()).toMatchObject({ ok: false, total: 3, passed: 1, failed: 2 });
  });

  it("does not throw when failFast is false and everything passes", async () => {
    const { reporter, getRunEnd } = recorder();

    await runFromMetadata({ scenarios: [scenario("a", true), scenario("b", true)], reporter, failFast: false });

    expect(getRunEnd()).toMatchObject({ ok: true, total: 2, passed: 2, failed: 0 });
  });
});
