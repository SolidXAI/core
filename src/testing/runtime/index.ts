/**
 * Entry point of the standalone testing runtime bundle (`npm run build:testing-runtime`).
 * The bundle is vendored by tools that must execute steps exactly as the runner does
 * (e.g. the AI agent's authoring session), so everything they rely on is exported here.
 */
import { createDefaultStepRegistry } from "./default-registry";

/**
 * Bumped when the step contract changes in a way vendored copies must notice. Consumers
 * compare it with the version they were written against.
 */
export const RUNTIME_VERSION = "1.0.0";

/**
 * Scenario features this runner understands. Authoring tools only emit a feature the
 * target runner lists, so files stay runnable on older runners.
 */
export const CAPABILITIES = [
  "selfHealing",
  "expectAriaSnapshot",
  "dependsOn",
  "saveSession",
  "sessionModes",
  "heals",
  "skippedStatus",
  "stepPath",
] as const;

export type RuntimeCapability = (typeof CAPABILITIES)[number];

/** Every op the built-in registry handles, sorted. */
export function listOps(): string[] {
  return createDefaultStepRegistry().ops();
}

export { createDefaultStepRegistry } from "./default-registry";
export { createStepExecutor, errorMessage } from "./step-executor";
export type {
  ScenarioRunResult,
  StepExecutor,
  StepExecutorOptions,
  StepRecord,
  StepRunResult,
} from "./step-executor";
export { PlaywrightAdapter } from "../adapters/ui/playwright-adapter";
export type { StorageState } from "../adapters/ui/playwright-adapter";
export { fingerprintSelectors, resolveTarget, PRIMARY_GRACE_MS } from "../adapters/ui/resolve-target";
export { StepRegistry } from "../core/step-registry";
export { TestingEngine, stepPathFor } from "../core/testing-engine";
export { interpolateDeep, collectSecretKeys } from "../core/interpolation";
export { normalizeBlock } from "../core/normalize-steps";
export { buildTestDataIndex } from "../runner/run-from-metadata";
export {
  expandWithDependencies,
  orderByDependencies,
  sessionSourceFor,
  usesDependencies,
  validateSessions,
} from "../runner/scenario-graph";
export type { HealEvent, StepPhase, TestContext } from "../contracts/runtime-context.types";
export type {
  HealingPolicy,
  OpStep,
  ScenarioSessionMode,
  ScenarioSpec,
  StepBlock,
  TargetFingerprint,
} from "../contracts/testing-metadata.types";
