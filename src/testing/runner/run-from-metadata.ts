import type { Reporter } from "../reporter/reporter.types";
import type { TestingMetadata, TestingDataRecord, ScenarioSpec } from "../contracts/testing-metadata.types";
import type { ApiAdapterOptions } from "../adapters/api/api.types";
import type { PlaywrightAdapterOptions } from "../adapters/ui/ui.types";
import type { MobileAdapterOptions } from "../adapters/mobile/mobile.types";
import { ApiAdapter } from "../adapters/api/api-adapter";
import { MobileAdapter } from "../adapters/mobile/mobile-adapter";
import { createDefaultStepRegistry } from "../runtime/default-registry";
import { SimpleResourceStore } from "../core/resource-store";
import { RandomDataRegistry } from "../core/random-data";
import { SpecRegistry } from "../core/spec-registry";
import { TestingEngine, type ScenarioSetup } from "../core/testing-engine";
import { filterScenarios } from "./scenario-filter";
import { collectSecretKeys } from "../core/interpolation";
import { planMobileSetup, splitResetScenario, type MobileSessionState } from "./mobile-session";
import { ensureMobileStarted, ensureUiStarted, mobileScenarioProblem, scenarioNeedsMobile, scenarioNeedsUi } from "./lifecycle";
import { ensureChromiumInstalled } from "../adapters/ui/browser-provisioner";
import { ConsoleReporter } from "../reporter/console-reporter";
import type { PlaywrightAdapter as UiAdapter, StorageState } from "../adapters/ui/playwright-adapter";
import {
  expandWithDependencies,
  orderByDependencies,
  sessionSourceFor,
  usesDependencies,
  validateSessions,
} from "./scenario-graph";

/**
 * Give a scenario the browser context its `session` asks for. `justStarted` skips a
 * redundant context swap when the browser was opened for this very scenario.
 */
async function prepareSession(
  ui: UiAdapter,
  scenario: ScenarioSpec,
  byId: Map<string, ScenarioSpec>,
  saved: Map<string, StorageState>,
  justStarted: boolean,
): Promise<void> {
  if (scenario.session === "fresh") {
    if (!justStarted) await ui.newContext();
    return;
  }
  if (scenario.session === "restore") {
    const source = sessionSourceFor(scenario, byId);
    const storageState = source ? saved.get(source) : undefined;
    if (!storageState) {
      // The source passed (or this scenario would have been skipped) but never opened a page.
      throw new Error(`Scenario "${scenario.id}" restores the session of "${source}", which saved no browser state`);
    }
    await ui.newContext({ storageState });
  }
}


export function buildTestDataIndex(data?: TestingDataRecord[]): Record<string, Record<string, any>> {
  const index: Record<string, Record<string, any>> = {};
  if (!Array.isArray(data)) return index;
  for (const record of data) {
    if (!record?.modelUserKey || !record?.recUserKeyValue) continue;
    if (!index[record.modelUserKey]) {
      index[record.modelUserKey] = {};
    }
    index[record.modelUserKey][record.recUserKeyValue] = record.data ?? {};
  }
  return index;
}

export type RunnerOptions = {
  metadata?: TestingMetadata;
  scenarios?: ScenarioSpec[];
  data?: TestingDataRecord[];
  externalRunId?: string;
  env?: Record<string, string>;
  scenarioIds?: string[];
  includeTags?: string[];
  skipScenarioIds?: string[];
  reporter?: Reporter;
  api?: ApiAdapterOptions;
  ui?: PlaywrightAdapterOptions;
  /** Device and app for mobile scenarios. Required when any scenario is a mobile scenario. */
  mobile?: MobileAdapterOptions;
  defaults?: { timeoutMs?: number; retries?: number };
  options?: { printApiLogs?: boolean };
  /**
   * Stop the run at the first failed scenario (default `true`). When `false`, every
   * scenario runs; the run still throws after the last one if any failed.
   */
  failFast?: boolean;
  specs?: (registry: SpecRegistry) => void;
  /**
   * Resolves `${secret:...}` references against the secret store. Injected by the
   * caller so this runner stays free of database and DI coupling. Required only if a
   * scenario actually references a secret.
   */
  resolveSecrets?: (keys: string[]) => Promise<Record<string, any>>;
};

/**
 * Resolves every secret referenced by the scenarios about to run, in one call, and
 * returns a per-scenario view of the result.
 *
 * Partitioned deliberately: ctxBase is shared across scenarios, so handing every
 * scenario the whole map would let each read secrets belonging to the others.
 */
async function resolveSecretsByScenario(
  scenarios: ScenarioSpec[],
  resolveSecrets?: RunnerOptions["resolveSecrets"],
): Promise<Map<string, Record<string, any>>> {
  const keysByScenario = new Map<string, string[]>();
  const allKeys = new Set<string>();

  for (const scenario of scenarios) {
    const keys = collectSecretKeys(scenario);
    if (keys.length === 0) continue;
    keysByScenario.set(scenario.id, keys);
    keys.forEach((key) => allKeys.add(key));
  }

  if (allKeys.size === 0) return new Map();

  if (!resolveSecrets) {
    throw new Error(
      `Scenarios reference secrets (${[...allKeys].join(", ")}) but no secret resolver was provided to the runner.`,
    );
  }

  // Resolved up front so a missing secret fails the run before any scenario executes.
  const resolved = await resolveSecrets([...allKeys]);

  const byScenario = new Map<string, Record<string, any>>();
  for (const [scenarioId, keys] of keysByScenario) {
    byScenario.set(
      scenarioId,
      keys.reduce((acc, key) => {
        acc[key] = resolved[key];
        return acc;
      }, {} as Record<string, any>),
    );
  }
  return byScenario;
}

export async function runFromMetadata(opts: RunnerOptions): Promise<void> {
  const startedAt = Date.now();
  const registry = createDefaultStepRegistry();

  const engine = new TestingEngine(registry, opts.defaults);
  // The reset scenario is setup, not a scenario: it is never selected, run on its own, or counted.
  const { reset: resetScenario, rest: allScenarios } = splitResetScenario(
    opts.scenarios ?? opts.metadata?.testing?.scenarios ?? [],
  );
  const selected = expandWithDependencies(
    allScenarios,
    filterScenarios(allScenarios, {
      scenarioIds: opts.scenarioIds,
      includeTags: opts.includeTags,
      skipScenarioIds: opts.skipScenarioIds,
    }),
  );
  // Without dependsOn/session settings a run keeps its original contract: file order,
  // one shared browser context, stop at the first failure.
  const dependencyMode = usesDependencies(selected);
  const scenarios = dependencyMode ? orderByDependencies(selected) : selected;
  if (dependencyMode) validateSessions(scenarios);
  const scenarioById = new Map(scenarios.map((s) => [s.id, s]));

  const specRegistry = new SpecRegistry();
  const testData = buildTestDataIndex(opts.data ?? opts.metadata?.testing?.data);
  if (opts.specs) {
    opts.specs(specRegistry);
  }

  // Fetch the browser before the reporter starts drawing its footer, so the download
  // gets a clean terminal and a missing browser fails before any scenario runs.
  if (scenarios.some(scenarioNeedsUi)) {
    await ensureChromiumInstalled();
  }

  const resources = new SimpleResourceStore();
  const reporter: Reporter = opts.reporter ?? new ConsoleReporter();
  const api = new ApiAdapter(opts.api);
  const { PlaywrightAdapter } = await import("../adapters/ui/playwright-adapter");
  const ui = new PlaywrightAdapter(opts.ui);
  const mobile = opts.mobile ? new MobileAdapter(opts.mobile) : undefined;
  const randomData = new RandomDataRegistry();
  const ctxBase = { resources, randomData, reporter, api, ui, mobile, specRegistry, testData, env: opts.env, options: opts.options };
  const uiStarted = { value: false };
  const mobileStarted = { value: false };
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let runError: unknown;
  const outcomes = new Map<string, "passed" | "failed" | "skipped">();
  const savedSessions = new Map<string, StorageState>();
  const mobileState: MobileSessionState = {};

  reporter.onRunStart?.({
    total: scenarios.length,
    startedAt: new Date(startedAt).toISOString(),
    scenarioIds: scenarios.map((s) => s.id),
    scenarios: scenarios.map((s) => ({ id: s.id, name: s.name, type: s.type })),
  });

  try {
    // Checked inside the try so a bad mobile setup still reports run.end.
    for (const scenario of scenarios) {
      const problem = mobileScenarioProblem(scenario);
      if (problem) throw new Error(problem);
      if (scenarioNeedsMobile(scenario) && !opts.mobile) {
        throw new Error(
          `Scenario "${scenario.id}" is a mobile scenario but the run has no mobile options (device and app). Start it from Test Hub, or pass RunnerOptions.mobile.`,
        );
      }
    }

    // One query for the whole run, after onRunStart so a failure here still reports
    // run.end. Keys that do not resolve are not fatal — they surface at the step that
    // references them, where the reporter can name the token and locate the failure.
    const secretsByScenario = await resolveSecretsByScenario(
      resetScenario ? [...scenarios, resetScenario] : scenarios,
      opts.resolveSecrets,
    );

    for (const scenario of scenarios) {
      if (dependencyMode) {
        const blocked = (scenario.dependsOn ?? []).find((dep) => outcomes.get(String(dep)) !== "passed");
        if (blocked !== undefined) {
          skipped += 1;
          outcomes.set(scenario.id, "skipped");
          reporter.onScenarioSkipped?.(scenario, { reason: "dependency_failed", dependency: String(blocked) });
          continue;
        }
      }
      if (scenarioNeedsUi(scenario)) {
        const wasStarted = uiStarted.value;
        await ensureUiStarted(ctxBase, uiStarted);
        if (dependencyMode) {
          try {
            await prepareSession(ui, scenario, scenarioById, savedSessions, !wasStarted);
          } catch (error) {
            reporter.onScenarioStart(scenario);
            reporter.onScenarioEnd(scenario, { ok: false, error, durationMs: 0 });
            failed += 1;
            runError = error;
            outcomes.set(scenario.id, "failed");
            continue;
          }
        }
      }
      let setup: ScenarioSetup[] = [];
      if (scenarioNeedsMobile(scenario)) {
        await ensureMobileStarted(ctxBase, mobileStarted);
        if (dependencyMode && mobile) {
          try {
            setup = planMobileSetup({
              scenario,
              phone: mobile.phone,
              byId: scenarioById,
              reset: resetScenario,
              state: mobileState,
              secretsOf: (id) => secretsByScenario.get(id),
            });
          } catch (error) {
            reporter.onScenarioStart(scenario);
            reporter.onScenarioEnd(scenario, { ok: false, error, durationMs: 0 });
            failed += 1;
            runError = error;
            outcomes.set(scenario.id, "failed");
            continue;
          }
        }
        // What the app is left in is only known for a producer that passes; anything else may have changed it.
        mobileState.loggedInBy = undefined;
      }
      try {
        await engine.runScenario(
          scenario,
          {
            ...ctxBase,
            secrets: secretsByScenario.get(scenario.id),
          },
          setup,
        );
        passed += 1;
        outcomes.set(scenario.id, "passed");
        if (scenario.saveSession && uiStarted.value) {
          savedSessions.set(scenario.id, await ui.storageState());
        }
        if (scenario.saveSession && scenarioNeedsMobile(scenario)) {
          mobileState.loggedInBy = scenario.id;
        }
      } catch (error) {
        failed += 1;
        outcomes.set(scenario.id, "failed");
        // Keep going; the first failure is rethrown once every scenario has run.
        // A dependsOn run always keeps going and skips the failed scenario's dependents.
        runError ??= error;
        if (!dependencyMode && opts.failFast !== false) throw error;
      }
    }
    if (runError) throw runError;
  } catch (error) {
    // Also catches a setup failure before the loop (unreachable database, absent
    // encryption key), which would otherwise leave runError unset and report ok: true.
    runError = error;
    throw error;
  } finally {
    reporter.onRunEnd?.({
      ok: !runError,
      total: scenarios.length,
      passed,
      failed,
      ...(dependencyMode ? { skipped } : {}),
      durationMs: Date.now() - startedAt,
    });
    if (uiStarted.value) {
      // Only KEEP the whole-run video when the run FAILED — passing runs discard it unread.
      const keepVideo = !!runError;
      await ui.stop({ keepVideo });
      // Video bytes are only finalized after ui.stop(); attach it as a run-level artifact so
      // the reporter uploads it and references it on run.end (queued before flushPending runs).
      if (keepVideo && reporter.attachRunArtifact) {
        for (const video of ui.getRunVideos()) {
          reporter.attachRunArtifact({ name: video.name, contentType: video.contentType, data: video.data });
        }
      }
    }
    if (mobile && mobileStarted.value) {
      // Same policy as the browser video: only keep the recording when the run failed.
      const keepVideo = !!runError;
      await mobile.stop({ keepVideo });
      if (keepVideo) {
        const video = mobile.getRunVideo();
        if (video && reporter.attachRunArtifact) {
          reporter.attachRunArtifact({ name: video.name, contentType: video.contentType, data: video.data });
        }
      }
    }
  }
}
