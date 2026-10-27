import type { HealEvent } from "../contracts/runtime-context.types";
import type { ScenarioType } from "../contracts/testing-metadata.types";

/**
 * Incremental lifecycle events emitted by {@link LifecycleWebhookReporter} so an
 * external consumer (e.g. testingHub) can persist run progress live, instead of
 * only receiving a single final payload (as the legacy WebhookReporter does).
 */
export type LifecycleEventType =
  | "run.start"
  | "scenario.start"
  | "scenario.end"
  | "run.end";

/**
 * Reference to a captured artifact (console/network/api log, screenshot, video, HAR).
 * Text artifacts travel inline; binary artifacts are uploaded to shared storage and
 * referenced by `storageKey`/`url` to keep webhook payloads small.
 */
export interface ArtifactRef {
  kind: "console" | "network" | "screenshot" | "video" | "har" | "api-log";
  name: string;
  contentType: string;
  transport: "inline" | "storage";
  /** base64 (binary) or raw text/JSON (text); present when transport === 'inline'. */
  inlineData?: string;
  /** file-service key; present when transport === 'storage'. */
  storageKey?: string;
  /** resolved getUrl(); present when transport === 'storage'. */
  url?: string;
  sizeBytes?: number;
}

export interface StepResultData {
  phase: string;
  operation: string;
  name?: string;
  /** Position in the scenario file, e.g. `steps[3].when`. */
  stepPath?: string;
  /** Mobile only: the longest single device lookup in the step, reported when it was slow (a stalled device). */
  slowestCallMs?: number;
  ok: boolean;
  durationMs: number;
  error?: string;
}

/** Minimal descriptor of a scenario in the run, so consumers can snapshot the full suite at run time. */
export interface ScenarioDescriptor {
  id: string;
  name?: string;
  type: ScenarioType;
}

export interface RunStartData {
  total: number;
  scenarioIds: string[];
  scenarios: ScenarioDescriptor[];
  startedAt: string;
}

export interface ScenarioStartData {
  scenarioId: string;
  name?: string;
  type: ScenarioType;
  index: number;
  total: number;
}

export interface ScenarioEndData {
  scenarioId: string;
  name?: string;
  ok: boolean;
  /**
   * Absent from older runners, where `ok` alone decides passed/failed. A skipped
   * scenario has `ok: false` so a consumer that ignores `status` never counts it as passed.
   */
  status?: "passed" | "failed" | "skipped";
  /** Set when `status` is `skipped`. */
  skip?: { reason: "dependency_failed"; dependency: string };
  durationMs: number;
  error?: string;
  steps: StepResultData[];
  /** console/network/api-log/screenshot/video for THIS scenario. */
  artifacts: ArtifactRef[];
  /** Selectors replaced by a fallback or fingerprint while the scenario ran. */
  heals?: HealEvent[];
}

export interface RunEndData {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  skipped?: number;
  durationMs: number;
  exitCode?: number;
  error?: string;
  /** run-level artifacts (e.g. the whole-run video). */
  artifacts?: ArtifactRef[];
}

/**
 * Envelope wrapping every lifecycle event. `externalRunId` correlates the event to
 * the caller's own record (e.g. a testingHub TestRun id); `seq` lets an out-of-order
 * receiver reorder/deduplicate.
 */
export interface LifecycleEnvelope<T = unknown> {
  event: LifecycleEventType;
  /** correlation id supplied by the caller (e.g. testingHub TestRun id). */
  externalRunId?: string;
  /** runner-generated uuid for this process run. */
  runId: string;
  runName: string;
  /** 0-based, increments per emitted event. */
  seq: number;
  emittedAt: string;
  data: T;
}
