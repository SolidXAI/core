import type { HealEvent, StepPhase } from "../contracts/runtime-context.types";
import type { OpStep, ScenarioSpec, ScenarioType } from "../contracts/testing-metadata.types";
import type { SolidTestSpecResult } from "../contracts/test-spec.types";

export interface ScenarioResult {
  ok: boolean;
  error?: unknown;
  durationMs: number;
  /** Selector heals applied while the scenario ran; absent when none. */
  heals?: HealEvent[];
}

export interface ScenarioSkipInfo {
  reason: "dependency_failed";
  /** The dependency that failed or was itself skipped. */
  dependency: string;
}

export interface Reporter {
  onRunStart?(args: {
    total: number;
    startedAt: string;
    scenarioIds: string[];
    scenarios?: Array<{ id: string; name?: string; type: ScenarioType }>;
  }): void;
  onScenarioStart(scenario: ScenarioSpec): void;
  onScenarioEnd(
    scenario: ScenarioSpec,
    result: ScenarioResult,
  ): void;
  /** A scenario that did not run because a `dependsOn` scenario failed or was skipped. */
  onScenarioSkipped?(scenario: ScenarioSpec, info: ScenarioSkipInfo): void;
  onStepStart(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    /** Position in the scenario file, e.g. `steps[3].when`. */
    stepPath?: string;
  }): void;
  onStepEnd(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
    stepPath?: string;
  }): void;
  onSpecResult?(args: {
    scenarioId: string;
    specId: string;
    stepName?: string;
    result: SolidTestSpecResult;
  }): void;
  attach?(args: {
    scenarioId: string;
    name: string;
    contentType: string;
    data: Buffer | string;
  }): void;
  /** Attach a run-level artifact (e.g. the whole-run video), emitted on run.end. */
  attachRunArtifact?(args: {
    name: string;
    contentType: string;
    data: Buffer | string;
  }): void;
  onRunEnd?(args: RunEndArgs): void;
}

export interface RunEndArgs {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  /** Scenarios not run because a dependency failed; only present in dependency-aware runs. */
  skipped?: number;
  durationMs: number;
}
