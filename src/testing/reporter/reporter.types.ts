import type { StepPhase } from "../contracts/runtime-context.types";
import type { OpStep, ScenarioSpec, ScenarioType } from "../contracts/testing-metadata.types";
import type { SolidTestSpecResult } from "../contracts/test-spec.types";

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
    result: { ok: boolean; error?: unknown; durationMs: number },
  ): void;
  onStepStart(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
  }): void;
  onStepEnd(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
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
  onRunEnd?(args: {
    ok: boolean;
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  }): void;
}
