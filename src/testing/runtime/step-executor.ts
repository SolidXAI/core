import type { Page } from "playwright";

import { ApiAdapter } from "../adapters/api/api-adapter";
import { PlaywrightAdapter } from "../adapters/ui/playwright-adapter";
import type { CaptureOptions } from "../adapters/ui/ui.types";
import type { HealEvent, StepPhase, TestContext } from "../contracts/runtime-context.types";
import type { HealingPolicy, OpStep, ScenarioSpec, ScenarioType } from "../contracts/testing-metadata.types";
import { SimpleResourceStore } from "../core/resource-store";
import { SpecRegistry } from "../core/spec-registry";
import type { StepRegistry } from "../core/step-registry";
import { TestingEngine } from "../core/testing-engine";
import type { Reporter, ScenarioResult } from "../reporter/reporter.types";
import { createDefaultStepRegistry } from "./default-registry";

export interface StepExecutorOptions {
  /** A page the caller owns; the executor never closes it. */
  page: Page;
  /** Base for relative `ui.goto` urls. */
  baseUrl?: string;
  /** Base for relative `api.*` urls. */
  apiBaseUrl?: string;
  apiHeaders?: Record<string, string>;
  env?: Record<string, string>;
  /** Already-resolved secret values for `${secret:...}` tokens. */
  secrets?: Record<string, any>;
  testData?: Record<string, Record<string, any>>;
  params?: Record<string, any>;
  defaultTimeoutMs?: number;
  navigationTimeoutMs?: number;
  healing?: HealingPolicy;
  capture?: CaptureOptions;
  scenarioId?: string;
  scenarioType?: ScenarioType;
  registry?: StepRegistry;
}

export interface StepRunResult {
  ok: boolean;
  op: string;
  phase: StepPhase;
  stepPath?: string;
  durationMs: number;
  error?: string;
  /** The handler's return value (what `saveAs` stores). */
  result?: unknown;
  heals: HealEvent[];
}

export interface StepRecord {
  phase: StepPhase;
  op: string;
  name?: string;
  stepPath?: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface ScenarioRunResult {
  ok: boolean;
  durationMs: number;
  error?: string;
  steps: StepRecord[];
  heals: HealEvent[];
}

export interface StepExecutor {
  readonly ui: PlaywrightAdapter;
  readonly context: TestContext;
  /** Run one step with the runner's exact semantics; never throws for a step failure. */
  runStep(step: OpStep, opts?: { phase?: StepPhase; stepPath?: string }): Promise<StepRunResult>;
  /** Run a whole scenario through the runner's engine against this page. */
  runScenario(scenario: ScenarioSpec): Promise<ScenarioRunResult>;
  /** Drop `saveAs` values, e.g. before replaying a scenario from its first step. */
  resetResources(): void;
}

export function errorMessage(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Reporter that records what the engine reports instead of printing it. */
class CollectingReporter implements Reporter {
  steps: StepRecord[] = [];
  scenarioResult?: ScenarioResult;
  onScenarioStart(): void {
    this.steps = [];
    this.scenarioResult = undefined;
  }

  onScenarioEnd(_scenario: ScenarioSpec, result: ScenarioResult): void {
    this.scenarioResult = result;
  }

  onStepStart(): void {}

  onStepEnd(args: {
    phase: StepPhase;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
    stepPath?: string;
  }): void {
    this.steps.push({
      phase: args.phase,
      op: args.step.op,
      name: args.step.name,
      stepPath: args.stepPath,
      ok: args.ok,
      durationMs: args.durationMs,
      error: args.error ? errorMessage(args.error) : undefined,
    });
  }
}

/**
 * Execute steps against a caller-owned page with the same handlers, interpolation,
 * timeouts, and healing the runner uses, so what an authoring session verifies is
 * what a TestHub run will do.
 */
export function createStepExecutor(opts: StepExecutorOptions): StepExecutor {
  const registry = opts.registry ?? createDefaultStepRegistry();
  const engine = new TestingEngine(registry);
  const ui = PlaywrightAdapter.attach(opts.page, {
    baseUrl: opts.baseUrl,
    defaultTimeoutMs: opts.defaultTimeoutMs,
    navigationTimeoutMs: opts.navigationTimeoutMs,
    healing: opts.healing,
    capture: opts.capture,
  });
  const api = new ApiAdapter({ baseUrl: opts.apiBaseUrl, defaultHeaders: opts.apiHeaders });

  const reporter = new CollectingReporter();
  let context: TestContext = {
    scenarioId: opts.scenarioId ?? "authoring",
    scenarioType: opts.scenarioType ?? "ui",
    params: opts.params ?? {},
    resources: new SimpleResourceStore(),
    api,
    ui,
    reporter,
    specRegistry: new SpecRegistry(),
    testData: opts.testData,
    env: opts.env,
    secrets: opts.secrets,
  };

  return {
    ui,
    get context() {
      return context;
    },

    async runStep(step, stepOpts) {
      const phase = stepOpts?.phase ?? "step";
      const healsBefore = ui.getHeals().length;
      const started = Date.now();
      try {
        const result = await engine.runStep(phase, step, context, stepOpts?.stepPath);
        return {
          ok: true,
          op: step.op,
          phase,
          stepPath: stepOpts?.stepPath,
          durationMs: Date.now() - started,
          result,
          heals: ui.getHeals().slice(healsBefore),
        };
      } catch (err) {
        return {
          ok: false,
          op: step.op,
          phase,
          stepPath: stepOpts?.stepPath,
          durationMs: Date.now() - started,
          error: errorMessage(err),
          heals: ui.getHeals().slice(healsBefore),
        };
      }
    },

    async runScenario(scenario) {
      const started = Date.now();
      const { scenarioId: _id, scenarioType: _type, params: _params, ...base } = context;
      let error: unknown;
      try {
        await engine.runScenario(scenario, base);
      } catch (err) {
        error = err;
      }
      return {
        ok: !error,
        durationMs: Date.now() - started,
        error: error ? errorMessage(error) : undefined,
        steps: [...reporter.steps],
        heals: reporter.scenarioResult?.heals ?? [],
      };
    },

    resetResources() {
      context = { ...context, resources: new SimpleResourceStore() };
    },
  };
}
