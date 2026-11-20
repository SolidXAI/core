// Purpose: a run can be canceled by its externalRunId. Aborting the signal stops the run before its next scenario,
// rejects with RunCanceledError, still reports run.end (not ok), and the registry only reaches runs it tracks.

import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import type { Reporter } from "../reporter/reporter.types";
import { cancelTestRun, registerRunCancellation, releaseRunCancellation, RunCanceledError } from "./run-cancellation";
import { runFromMetadata } from "./run-from-metadata";

const scenario = (id: string): ScenarioSpec => ({
  id,
  type: "api",
  steps: [{ op: "assert.equals", with: { actual: 1, expected: 1 } }],
});

describe("runFromMetadata: cancellation", () => {
  it("does not start the next scenario once the signal is aborted, and rejects with RunCanceledError", async () => {
    const controller = new AbortController();
    const ended: string[] = [];
    let runEnd: { ok: boolean } | undefined;
    const reporter: Reporter = {
      onScenarioStart: () => undefined,
      // The first scenario finishes, then the run is canceled.
      onScenarioEnd: (s) => {
        ended.push(s.id);
        controller.abort();
      },
      onStepStart: () => undefined,
      onStepEnd: () => undefined,
      onRunEnd: (r) => {
        runEnd = r;
      },
    };

    await expect(
      runFromMetadata({ scenarios: [scenario("a"), scenario("b"), scenario("c")], reporter, signal: controller.signal }),
    ).rejects.toBeInstanceOf(RunCanceledError);

    expect(ended).toEqual(["a"]);
    expect(runEnd?.ok).toBe(false);
  });

  it("runs every scenario when the signal is never aborted", async () => {
    const controller = new AbortController();
    const ended: string[] = [];
    const reporter: Reporter = {
      onScenarioStart: () => undefined,
      onScenarioEnd: (s) => void ended.push(s.id),
      onStepStart: () => undefined,
      onStepEnd: () => undefined,
    };

    await runFromMetadata({ scenarios: [scenario("a"), scenario("b")], reporter, signal: controller.signal });

    expect(ended).toEqual(["a", "b"]);
  });
});

describe("run cancellation registry", () => {
  it("aborts the signal of a registered run, and says whether it found one", () => {
    const signal = registerRunCancellation("run-1");

    expect(cancelTestRun("run-1")).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(cancelTestRun("run-unknown")).toBe(false);

    releaseRunCancellation("run-1");
  });

  it("no longer reaches a run once it has been released", () => {
    registerRunCancellation("run-2");
    releaseRunCancellation("run-2");

    expect(cancelTestRun("run-2")).toBe(false);
  });
});
