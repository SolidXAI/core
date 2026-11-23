import type { HealEvent, StepDataUsed, StepPhase } from "../contracts/runtime-context.types";
import type { OpStep, ScenarioSpec, ScenarioType, SetupScope } from "../contracts/testing-metadata.types";
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

/** Why a scenario did not run: its setup failed (`setup`), or a `dependsOn` scenario did not pass (`gate`). */
export interface BlockedBy {
  kind: "setup" | "gate";
  id: string;
  error?: string;
}

/** How a scenario's setup was brought up for it. */
export interface ScenarioSetupInfo {
  id: string;
  reused: boolean;
  durationMs: number;
  readyCheck: "passed" | "retried";
}

export interface Reporter {
  onRunStart?(args: {
    total: number;
    startedAt: string;
    scenarioIds: string[];
    scenarios?: Array<{ id: string; name?: string; type: ScenarioType }>;
    setups?: Array<{ id: string; name: string; scope: SetupScope }>;
    order?: "file" | "shuffle";
    shuffleSeed?: string;
  }): void;
  onScenarioStart(scenario: ScenarioSpec): void;
  onScenarioEnd(
    scenario: ScenarioSpec,
    result: ScenarioResult,
  ): void;
  /** A scenario that did not run because a `dependsOn` scenario failed or was skipped. */
  onScenarioSkipped?(scenario: ScenarioSpec, info: ScenarioSkipInfo): void;
  /** A scenario that did not run because its setup failed or a `dependsOn` gate did not pass. Never counted as failed. */
  onScenarioBlocked?(scenario: ScenarioSpec, blockedBy: BlockedBy): void;
  /** A setup attempt starts. `forScenarioId` is the consumer that needs the setup. */
  onSetupStart?(args: { setupId: string; attempt: number; forScenarioId: string }): void;
  /** A setup attempt ends. `reused` is true when a cached run-scoped state was used and no steps ran. */
  onSetupEnd?(args: {
    setupId: string;
    attempt: number;
    forScenarioId: string;
    ok: boolean;
    durationMs: number;
    error?: unknown;
    reused: boolean;
  }): void;
  onTeardownEnd?(args: { setupId: string; ok: boolean; durationMs: number; error?: unknown }): void;
  /** Setup info for a consumer scenario; reported on that scenario's end. */
  onScenarioSetup?(scenarioId: string, info: ScenarioSetupInfo): void;
  onStepStart(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    /** Position in the scenario file, e.g. `steps[3].when`. */
    stepPath?: string;
    /** Set for a step that runs as setup for the scenario ("reset", "login"), not as one of its own. */
    setup?: string;
  }): void;
  onStepEnd(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
    stepPath?: string;
    /** Mobile only: the longest single device lookup in the step, when it was slow enough to matter (a stalled device). */
    slowestCallMs?: number;
    /** Random values the step generated and text its `match` regexes extracted. */
    data?: StepDataUsed[];
    setup?: string;
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
  /** Scenarios not run because their setup failed or a gate did not pass. */
  blocked?: number;
  durationMs: number;
}
