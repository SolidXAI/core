import type { StepPhase } from "../contracts/runtime-context.types";
import type { OpStep, ScenarioSpec } from "../contracts/testing-metadata.types";
import type { SolidTestSpecResult } from "../contracts/test-spec.types";

export interface Reporter {
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
  onRunEnd?(args: {
    ok: boolean;
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  }): void;
}
