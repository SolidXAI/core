import type { Reporter } from "../reporter/reporter.types";
import type { TestingMetadata, TestingDataRecord, ScenarioSpec, SetupSpec } from "../contracts/testing-metadata.types";
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
import { buildTestDataIndex, finishMedia, resolveSecretsByScenario, type RunnerOptions } from "./run-shared";
import { planMobileSetup, splitResetScenario, type MobileSessionState } from "./mobile-session";
import {
  cleanStartProblem,
  ensureMobileStarted,
  ensureUiStarted,
  mobileScenarioProblem,
  scenarioNeedsMobile,
  scenarioNeedsUi,
  startsWithCleanApp,
  withoutLeadingClear,
} from "./lifecycle";
import { ensureChromiumInstalled } from "../adapters/ui/browser-provisioner";
import { RunCanceledError } from "./run-cancellation";
import { ConsoleReporter } from "../reporter/console-reporter";
import type { PlaywrightAdapter as UiAdapter, StorageState } from "../adapters/ui/playwright-adapter";
import {
  expandWithDependencies,
  orderByDependencies,
  expandRestoreFrom,
  sessionSourceFor,
  splitUnrunnable,
  usesDependencies,
  validateSessions,
  type UnrunnableScenario,
} from "./scenario-graph";

/**
 * Give a scenario the browser context its `session` asks for. `justStarted` skips a
 * redundant context swap when the browser was opened for this very scenario.
 */

/**
 * The scenarios set aside as unrunnable that this run reports: the ones it selected, plus the broken ones they wait on
 * (so a skip names a failure the run shows). Broken ones first, so each skip follows the failure that caused it.
 */
function selectedUnrunnable(unrunnable: UnrunnableScenario[], selected: Array<{ id: string }>): UnrunnableScenario[] {
  const byId = new Map(unrunnable.map((u) => [u.scenario.id, u]));
  const keep = new Set<string>();
  for (const { id } of selected) {
    for (let at = byId.get(id); at && !keep.has(at.scenario.id); at = at.blockedBy ? byId.get(at.blockedBy) : undefined) {
      keep.add(at.scenario.id);
    }
  }
  const kept = unrunnable.filter((u) => keep.has(u.scenario.id));
  return [...kept.filter((u) => u.error), ...kept.filter((u) => !u.error)];
}

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

export async function runLegacy(opts: RunnerOptions): Promise<void> {
  const startedAt = Date.now();
  const registry = createDefaultStepRegistry();

  const engine = new TestingEngine(registry, opts.defaults);
  // The reset scenario is setup, not a scenario: it is never selected, run on its own, or counted.
  const { reset: resetScenario, rest: unexpandedScenarios } = splitResetScenario(
    opts.scenarios ?? opts.metadata?.testing?.scenarios ?? [],
  );
  // A scenario whose restoreFrom or dependsOn names a scenario that is not there cannot run, nor can what needs it. They
  // are reported as failed / skipped below instead of stopping the run before the others start.
  const { runnable, unrunnable } = splitUnrunnable(unexpandedScenarios, resetScenario?.id);
  // restoreFrom becomes dependsOn + session: restore + saveSession on its source, so the rest of the run sees only those.
  const allScenarios = expandRestoreFrom(runnable, resetScenario?.id);
  const filterOptions = {
    scenarioIds: opts.scenarioIds,
    includeTags: opts.includeTags,
    skipScenarioIds: opts.skipScenarioIds,
  };
  const selected = expandWithDependencies(allScenarios, filterScenarios(allScenarios, filterOptions));
  const notRunnable = selectedUnrunnable(unrunnable, filterScenarios(unrunnable.map((u) => u.scenario), filterOptions));
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
  // When the run is canceled, close what it opened right away rather than waiting for the step in flight, so a
  // headed browser window goes away. The `finally` below skips closing them a second time.
  let uiClosedOnCancel = false;
  let mobileClosedOnCancel = false;
  const closeOnCancel = () => {
    if (uiStarted.value) {
      uiClosedOnCancel = true;
      void ui.stop({ keepVideo: false }).catch(() => undefined);
    }
    if (mobile && mobileStarted.value) {
      mobileClosedOnCancel = true;
      void mobile.stop({ keepVideo: false }).catch(() => undefined);
    }
  };
  opts.signal?.addEventListener("abort", closeOnCancel, { once: true });
  const throwIfCanceled = () => {
    if (opts.signal?.aborted) throw new RunCanceledError();
  };

  const reported = [...notRunnable.map((u) => u.scenario), ...scenarios];
  reporter.onRunStart?.({
    total: reported.length,
    startedAt: new Date(startedAt).toISOString(),
    scenarioIds: reported.map((s) => s.id),
    scenarios: reported.map((s) => ({ id: s.id, name: s.name, type: s.type })),
  });

  try {
    // Scenarios that cannot run fail (a broken reference) or are skipped (they need one that cannot run), and the run goes on.
    for (const { scenario, error, blockedBy } of notRunnable) {
      if (error) {
        const failure = new Error(error);
        reporter.onScenarioStart(scenario);
        reporter.onScenarioEnd(scenario, { ok: false, error: failure, durationMs: 0 });
        failed += 1;
        runError = failure;
        outcomes.set(scenario.id, "failed");
      } else {
        skipped += 1;
        outcomes.set(scenario.id, "skipped");
        reporter.onScenarioSkipped?.(scenario, { reason: "dependency_failed", dependency: String(blockedBy) });
      }
    }
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
    // An iOS device with no build cannot clear an app's data: say so now, naming the scenarios, not at their first step.
    const noReinstall = !!mobile && !mobile.canReinstall;
    const cleanProblem = cleanStartProblem(scenarios, { noReinstall }, resetScenario);
    if (cleanProblem) throw new Error(cleanProblem);

    // One query for the whole run, after onRunStart so a failure here still reports
    // run.end. Keys that do not resolve are not fatal — they surface at the step that
    // references them, where the reporter can name the token and locate the failure.
    const secretsByScenario = await resolveSecretsByScenario(
      resetScenario ? [...scenarios, resetScenario] : scenarios,
      opts.resolveSecrets,
    );

    for (const scenario of scenarios) {
      throwIfCanceled();
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
            if (opts.failFast !== false) throw error;
            continue;
          }
        }
      }
      let setup: ScenarioSetup[] = [];
      // On an iOS device that cannot clear data, a scenario that starts clean is started by the reset scenario instead, and its
      // own first step only relaunches the app.
      const cleanFirst = !!mobile && !mobile.canReinstall && scenarioNeedsMobile(scenario) && startsWithCleanApp(scenario);
      if (scenarioNeedsMobile(scenario)) {
        await ensureMobileStarted(ctxBase, mobileStarted);
        if ((dependencyMode || cleanFirst) && mobile) {
          try {
            setup = planMobileSetup({
              scenario: cleanFirst && (scenario.session ?? "shared") === "shared" ? { ...scenario, session: "fresh" } : scenario,
              noReinstall: !mobile.canReinstall,
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
            if (opts.failFast !== false) throw error;
            continue;
          }
        }
        // What the app is left in is only known for a producer that passes; anything else may have changed it.
        mobileState.loggedInBy = undefined;
      }
      try {
        await engine.runScenario(
          cleanFirst ? withoutLeadingClear(scenario) : scenario,
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
        if (scenarioNeedsMobile(scenario)) {
          // Where the app was last brought to a restore source's state. A scenario that sets no session leaves this as it was:
          // the next restore checks the device before it trusts it.
          if (scenario.saveSession) mobileState.mayBeIn = scenario.id;
          else if (scenario.session === "restore") mobileState.mayBeIn = sessionSourceFor(scenario, scenarioById);
          else if (scenario.session === "fresh") mobileState.mayBeIn = undefined;
        }
      } catch (error) {
        failed += 1;
        outcomes.set(scenario.id, "failed");
        // failFast (the default) stops the run here, with or without dependencies. Otherwise keep going: the
        // first failure is rethrown once every scenario has run, and a dependsOn run skips the failed one's dependents.
        runError ??= error;
        throwIfCanceled();
        if (opts.failFast !== false) throw error;
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
      total: reported.length,
      passed,
      failed,
      ...(dependencyMode || skipped > 0 ? { skipped } : {}),
      durationMs: Date.now() - startedAt,
    });
    opts.signal?.removeEventListener("abort", closeOnCancel);
    await finishMedia({
      opts,
      reporter,
      ui,
      mobile,
      scenarios,
      outcomes,
      runError,
      uiStarted,
      mobileStarted,
      uiClosedOnCancel,
      mobileClosedOnCancel,
    });
  }
}
