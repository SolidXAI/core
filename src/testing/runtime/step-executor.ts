import type { Page } from "playwright";

import { ApiAdapter } from "../adapters/api/api-adapter";
import { MobileAdapter } from "../adapters/mobile/mobile-adapter";
import type { MobileClock, MobileDriver } from "../adapters/mobile/mobile.types";
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

/** The part of an adapter the executors need to report what a step healed. */
interface HealSource {
  getHeals(): HealEvent[];
}

/**
 * Running one step, or a whole scenario, through the engine against a context the caller holds. The web and the mobile
 * executor differ only in the adapter on that context, so they share this and cannot drift apart.
 */
function drive(
  engine: TestingEngine,
  reporter: CollectingReporter,
  state: { context: TestContext },
  heals: HealSource,
): Pick<StepExecutor, "runStep" | "runScenario" | "resetResources"> {
  return {
    async runStep(step, stepOpts) {
      const phase = stepOpts?.phase ?? "step";
      const healsBefore = heals.getHeals().length;
      const started = Date.now();
      try {
        const result = await engine.runStep(phase, step, state.context, stepOpts?.stepPath);
        return {
          ok: true,
          op: step.op,
          phase,
          stepPath: stepOpts?.stepPath,
          durationMs: Date.now() - started,
          result,
          heals: heals.getHeals().slice(healsBefore),
        };
      } catch (err) {
        return {
          ok: false,
          op: step.op,
          phase,
          stepPath: stepOpts?.stepPath,
          durationMs: Date.now() - started,
          error: errorMessage(err),
          heals: heals.getHeals().slice(healsBefore),
        };
      }
    },

    async runScenario(scenario) {
      const started = Date.now();
      const { scenarioId: _id, scenarioType: _type, params: _params, ...base } = state.context;
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
      state.context = { ...state.context, resources: new SimpleResourceStore() };
    },
  };
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
  const state = {
    context: {
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
    } as TestContext,
  };

  return {
    ui,
    get context() {
      return state.context;
    },
    ...drive(engine, reporter, state, ui),
  };
}

export interface MobileStepExecutorOptions {
  /** A driver the caller opened and keeps; the executor never ends its session. */
  driver: MobileDriver;
  platformName?: "Android" | "iOS";
  /** The Android package, or the iOS bundle id. */
  appPackage: string;
  /** Needed on Android to start the app; unused by the steps themselves. */
  appActivity?: string;
  /** iOS: the app's executable name, to pick its lines out of the device log. */
  appProcessName?: string;
  /** iOS: the device is a Simulator. An iOS device that is not a Simulator is a real iPhone, which cannot clear app data. */
  simulator?: boolean;
  /** Already-resolved secret values for `${secret:...}` tokens. */
  secrets?: Record<string, any>;
  testData?: Record<string, Record<string, any>>;
  params?: Record<string, any>;
  env?: Record<string, string>;
  defaultTimeoutMs?: number;
  navigationTimeoutMs?: number;
  /** An authoring session passes "off" so a broken locator cannot hide behind a fallback. */
  healing?: HealingPolicy;
  /** Failure artifacts to collect; `screenshot` adds the page source next to it. */
  capture?: { console?: boolean; screenshot?: boolean };
  scenarioId?: string;
  registry?: StepRegistry;
  /** Test hook: the time source for element polling, so specs do not wait in real time. */
  clock?: MobileClock;
}

export interface MobileStepExecutor extends Pick<StepExecutor, "runStep" | "runScenario" | "resetResources"> {
  readonly mobile: MobileAdapter;
  readonly context: TestContext;
}

/**
 * The mobile counterpart of {@link createStepExecutor}: runs `mobile.*` steps on a driver the caller owns with the
 * runner's own handlers, timeouts and healing.
 */
export function createMobileStepExecutor(opts: MobileStepExecutorOptions): MobileStepExecutor {
  const registry = opts.registry ?? createDefaultStepRegistry();
  const engine = new TestingEngine(registry);
  const mobile = MobileAdapter.attach(opts.driver, {
    platformName: opts.platformName,
    appPackage: opts.appPackage,
    appActivity: opts.appActivity,
    appProcessName: opts.appProcessName,
    simulator: opts.simulator,
    defaultTimeoutMs: opts.defaultTimeoutMs,
    navigationTimeoutMs: opts.navigationTimeoutMs,
    healing: opts.healing,
    capture: opts.capture,
    clock: opts.clock,
  });

  const reporter = new CollectingReporter();
  const state = {
    context: {
      scenarioId: opts.scenarioId ?? "authoring",
      scenarioType: "mobile",
      params: opts.params ?? {},
      resources: new SimpleResourceStore(),
      mobile,
      reporter,
      specRegistry: new SpecRegistry(),
      testData: opts.testData,
      env: opts.env,
      secrets: opts.secrets,
    } as TestContext,
  };

  return {
    mobile,
    get context() {
      return state.context;
    },
    ...drive(engine, reporter, state, mobile),
  };
}
