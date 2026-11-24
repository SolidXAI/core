import type { Reporter, BlockedBy } from "../reporter/reporter.types";
import type { ScenarioSpec, SetupSpec } from "../contracts/testing-metadata.types";
import type { TestContext } from "../contracts/runtime-context.types";
import { ApiAdapter } from "../adapters/api/api-adapter";
import { createDefaultStepRegistry } from "../runtime/default-registry";
import { SimpleResourceStore } from "../core/resource-store";
import { RandomDataRegistry } from "../core/random-data";
import { SpecRegistry } from "../core/spec-registry";
import { TestingEngine } from "../core/testing-engine";
import { filterScenarios } from "./scenario-filter";
import { buildTestDataIndex, finishMedia, resolveSecretsByScenario, type RunnerOptions } from "./run-shared";
import { ensureUiStarted, scenarioNeedsUi } from "./lifecycle";
import { ensureChromiumInstalled } from "../adapters/ui/browser-provisioner";
import { RunCanceledError } from "./run-cancellation";
import { ConsoleReporter } from "../reporter/console-reporter";
import { parseRestoreFrom, type RestoreRef } from "./restore-ref";
import { setupChain, validateIndependent } from "./setup-graph";
import { orderForRun } from "./run-order";
import { InMemorySessionStore, type SetupState } from "./session-store";
import { SetupFailedError, SetupManager, type AcquireResult, type SetupManagerDeps, type TeardownDue } from "./setup-manager";

type Outcome = "passed" | "failed" | "blocked";

const isUiSetup = (setup: SetupSpec) => setup.type === "ui" || setup.type === "mixed";

/** A setup as a scenario-like object, for the helpers that take scenarios (secrets, browser need, video). */
function setupAsScenario(setup: SetupSpec): ScenarioSpec {
  return {
    id: `setup:${setup.id}`,
    type: setup.type,
    steps: [...setup.steps, ...(setup.ready ?? []), ...(setup.teardown ?? [])],
  };
}

function firstLine(text: string): string {
  return text.split("\n")[0];
}

/**
 * Runs UI and API scenarios independently: every scenario starts in its own new browser context and its own variable
 * store, seeded only from the setup its `restoreFrom` names. Nothing a scenario does is visible to any other.
 */
export async function runIndependent(opts: RunnerOptions): Promise<void> {
  const startedAt = Date.now();
  const registry = createDefaultStepRegistry();
  const engine = new TestingEngine(registry, opts.defaults);

  // 1. Load and validate. Problems are per scenario or per setup, so one broken one fails only itself.
  const allScenarios = opts.scenarios ?? opts.metadata?.testing?.scenarios ?? [];
  const allSetups = opts.setups ?? opts.metadata?.testing?.setups ?? [];
  const { setupErrors, scenarioErrors } = validateIndependent(allScenarios, allSetups);
  // First id wins; a setup with a validation problem is never usable.
  const setups = new Map<string, SetupSpec>();
  for (const setup of allSetups) {
    if (!setups.has(setup.id) && !setupErrors.has(setup.id)) setups.set(setup.id, setup);
  }

  // 2. Select. dependsOn targets and restoreFrom sources are never added: setups are not scenarios.
  const selected = filterScenarios(allScenarios, {
    scenarioIds: opts.scenarioIds,
    includeTags: opts.includeTags,
    skipScenarioIds: opts.skipScenarioIds,
  });

  // 3. Split off the scenarios that cannot run; they are reported as failed first.
  const invalid = selected.filter((s) => scenarioErrors.has(s.id));
  const runnable = selected.filter((s) => !scenarioErrors.has(s.id));

  // 4. Order. Anything other than "shuffle" is file order.
  const { ordered, order, shuffleSeed } = orderForRun(runnable, {
    order: opts.order === "shuffle" ? "shuffle" : "file",
    shuffleSeed: opts.shuffleSeed,
  });

  // 5. Plan the setups this run will use (root first), and the last consumer of each (used by teardown, R8).
  const planned: SetupSpec[] = [];
  const lastConsumerIndex = new Map<string, number>();
  for (const [index, scenario] of ordered.entries()) {
    const ref = parseRestoreFrom(scenario.restoreFrom);
    if (!ref || "error" in ref) continue;
    for (const id of setupChain(ref.setupId, setups)) {
      const setup = setups.get(id);
      if (setup && !planned.includes(setup)) planned.push(setup);
      lastConsumerIndex.set(id, index);
    }
  }

  const specRegistry = new SpecRegistry();
  const testData = buildTestDataIndex(opts.data ?? opts.metadata?.testing?.data);
  if (opts.specs) opts.specs(specRegistry);

  // Fetch the browser before the reporter starts drawing its footer, so the download gets a clean terminal and a
  // missing browser fails before any scenario runs.
  if (ordered.some(scenarioNeedsUi) || planned.some(isUiSetup)) {
    await ensureChromiumInstalled();
  }

  const reporter: Reporter = opts.reporter ?? new ConsoleReporter();
  const api = new ApiAdapter(opts.api);
  const { PlaywrightAdapter } = await import("../adapters/ui/playwright-adapter");
  const ui = new PlaywrightAdapter({ ...opts.ui, recordInitialContext: false });
  const randomData = new RandomDataRegistry();
  // `resources` here is only a placeholder: every scenario, setup and ready check gets a store of its own.
  const ctxBase = {
    resources: new SimpleResourceStore(),
    randomData,
    reporter,
    api,
    ui,
    mobile: undefined,
    specRegistry,
    testData,
    env: opts.env,
    options: opts.options,
  };
  const uiStarted = { value: false };
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let runError: unknown;
  const outcomes = new Map<string, Outcome>();
  const inRun = new Set(selected.map((s) => s.id));

  // When the run is canceled, close the browser right away rather than waiting for the step in flight, so a headed
  // window goes away. finishMedia skips closing it a second time.
  let uiClosedOnCancel = false;
  const closeOnCancel = () => {
    if (uiStarted.value) {
      uiClosedOnCancel = true;
      void ui.stop({ keepVideo: false }).catch(() => undefined);
    }
  };
  opts.signal?.addEventListener("abort", closeOnCancel, { once: true });
  const throwIfCanceled = () => {
    if (opts.signal?.aborted) throw new RunCanceledError();
  };

  // 6. Start. `total` counts scenarios only, never setups.
  const reported = [...invalid, ...ordered];
  reporter.onRunStart?.({
    total: reported.length,
    startedAt: new Date(startedAt).toISOString(),
    scenarioIds: reported.map((s) => s.id),
    scenarios: reported.map((s) => ({ id: s.id, name: s.name, type: s.type })),
    setups: planned.map(({ id, name }) => ({ id, name })),
    order,
    ...(shuffleSeed !== undefined ? { shuffleSeed } : {}),
  });

  let secretsByScenario = new Map<string, Record<string, any>>();

  // Runs a setup's, ready check's or teardown's steps. Used by the SetupManager, and directly for ready (and teardown, R8).
  const runSteps: SetupManagerDeps["runSteps"] = async ({ kind, setup, steps, forScenarioId, startFrom, inCurrentContext }) => {
    throwIfCanceled();
    const ownerId = kind === "ready" ? forScenarioId : `setup:${setup.id}`;
    const store = new SimpleResourceStore();
    for (const [name, value] of Object.entries(startFrom?.exports ?? {})) store.set(name, value);
    const usesUi = isUiSetup(setup);
    if (usesUi && !inCurrentContext) {
      await ensureUiStarted(ctxBase, uiStarted);
      // Setups and teardowns are not filmed: the run video shows scenarios only.
      await ui.newContext({ storageState: startFrom?.storageState, sessionStorage: startFrom?.sessionStorage, record: false });
      ui.resetCapture();
    }
    const ctx: TestContext = {
      ...ctxBase,
      resources: store,
      secrets: secretsByScenario.get(`setup:${setup.id}`),
      scenarioId: ownerId,
      scenarioType: setup.type,
      params: {},
    };
    try {
      // Heals found here belong to the setup, even in a ready check, which is reported under the consumer.
      await engine.runSteps(steps, ctx, kind, ownerId, `setup:${setup.id}`);
    } catch (error) {
      // Failure artifacts go out before the caller reports the attempt's end, or they are dropped.
      if (usesUi && ui.page && reporter.attach) {
        try {
          for (const a of await ui.collectFailureArtifacts()) {
            reporter.attach({ scenarioId: ownerId, name: a.name, contentType: a.contentType, data: a.data });
          }
        } catch {
          // Best-effort, like the scenario artifacts.
        }
      }
      throw error;
    }
    const resources: Record<string, unknown> = {};
    for (const name of setup.exports ?? []) if (store.has(name)) resources[name] = store.get(name);
    if (kind === "setup" && usesUi) {
      // While the setup's tab is still on the app's origin: pages on about:blank are not captured.
      const state: SetupState = {
        storageState: await ui.storageState(),
        sessionStorage: await ui.captureSessionStorage(),
        exports: {},
      };
      return { state, resources };
    }
    return { resources };
  };

  const manager = new SetupManager({
    setups,
    store: new InMemorySessionStore(),
    applicationKey: opts.applicationKey ?? "local",
    runSteps,
    reporter,
  });

  const blockScenario = (scenario: ScenarioSpec, blockedBy: BlockedBy) => {
    blocked += 1;
    outcomes.set(scenario.id, "blocked");
    reporter.onScenarioBlocked?.(scenario, blockedBy);
  };

  /** A failure of the scenario itself (not run through the engine). Returns true when the run should stop. */
  const failScenario = (scenario: ScenarioSpec, error: unknown): boolean => {
    reporter.onScenarioStart(scenario);
    reporter.onScenarioEnd(scenario, { ok: false, error, durationMs: 0 });
    failed += 1;
    outcomes.set(scenario.id, "failed");
    runError ??= error;
    throwIfCanceled();
    return opts.failFast !== false;
  };

  /** Runs one scenario. Returns "stop" when a failure should end the run (failFast). */
  const runOne = async (scenario: ScenarioSpec): Promise<"next" | "stop"> => {
    throwIfCanceled();

    // Gate: a dependsOn scenario that is in this run and did not pass blocks this one.
    const gate = (scenario.dependsOn ?? []).find((dep) => inRun.has(String(dep)) && outcomes.get(String(dep)) !== "passed");
    if (gate !== undefined) {
      blockScenario(scenario, { kind: "gate", id: String(gate) });
      return "next";
    }

    const needsUi = scenarioNeedsUi(scenario);
    const parsed = parseRestoreFrom(scenario.restoreFrom);
    const ref: RestoreRef | undefined = parsed && !("error" in parsed) ? parsed : undefined;
    let acquired: AcquireResult | undefined;
    let acquireMs = 0;
    let readyCheck: "passed" | "retried" = "passed";

    if (ref) {
      const setup = setups.get(ref.setupId) as SetupSpec;
      const runsReady = needsUi && isUiSetup(setup);
      const blockBySetup = (message: string, rootSetupId?: string) => {
        const root = rootSetupId !== undefined ? setups.get(rootSetupId) : undefined;
        if (root && isUiSetup(root)) outcomes.set(`setup:${root.id}`, "failed");
        blockScenario(scenario, { kind: "setup", id: ref.setupId, error: message });
      };
      for (let attempt = 1; ; attempt += 1) {
        try {
          acquired = await manager.acquire(ref.setupId, { forScenarioId: scenario.id, fresh: ref.fresh });
        } catch (error) {
          throwIfCanceled();
          if (error instanceof SetupFailedError) {
            blockBySetup(error.message, error.setupId);
            return "next";
          }
          throw error;
        }
        acquireMs += acquired.durationMs;
        // Always a new context, seeded from the setup, before the scenario starts (so the scenario's own start
        // clears the seed request from the network log). Seeding navigates, so it can throw.
        try {
          if (needsUi) {
            await ensureUiStarted(ctxBase, uiStarted);
            // With a ready check this context is only for the check, so it is not filmed.
            await ui.newContext({ storageState: acquired.state.storageState, sessionStorage: acquired.state.sessionStorage, record: !runsReady });
          }
          if (runsReady) {
            await runSteps({
              kind: "ready",
              setup,
              steps: setup.ready ?? [],
              attempt,
              forScenarioId: scenario.id,
              startFrom: acquired.state,
              inCurrentContext: true,
            });
            // The ready check ran off camera; the scenario gets a filmed context seeded from the same state (as a
            // retry does in beforeRetry). runsReady implies needsUi.
            await ui.newContext({ storageState: acquired.state.storageState, sessionStorage: acquired.state.sessionStorage });
          }
          break;
        } catch (error) {
          throwIfCanceled();
          if (attempt >= 2) {
            const message = `Setup "${setup.name}" is not ready: ${firstLine(error instanceof Error ? error.message : String(error))}`;
            manager.markFailed(ref.setupId, message);
            blockBySetup(message, ref.setupId);
            return "next";
          }
          // The cached state no longer works: drop it, run the setup again and check again.
          manager.invalidate(ref.setupId);
          readyCheck = "retried";
        }
      }
    } else if (needsUi) {
      try {
        await ensureUiStarted(ctxBase, uiStarted);
        await ui.newContext();
      } catch (error) {
        throwIfCanceled();
        return failScenario(scenario, error) ? "stop" : "next";
      }
    }

    // A cancel while the setup or ready check was in flight must not start the scenario (or a browser for it).
    throwIfCanceled();

    const tellSetup = () => {
      if (ref && acquired) {
        reporter.onScenarioSetup?.(scenario.id, { id: ref.setupId, reused: acquired.reused, durationMs: acquireMs, readyCheck });
      }
    };
    // Every attempt gets its own store, seeded from a copy of the exports: a step such as saveAs "login.token" changes
    // nested objects in place, and a retry must not see what the failed attempt did.
    const attemptBase = () => {
      const store = new SimpleResourceStore();
      for (const [name, value] of Object.entries(structuredClone(acquired?.state.exports ?? {}))) store.set(name, value);
      return { ...ctxBase, resources: store, secrets: secretsByScenario.get(scenario.id) };
    };
    // A retry starts from the same clean state as the first attempt: a new context seeded from the same setup state
    // (the setup is not run again, nor its ready check) and a new store. The reporter forgets the setup info at each
    // scenario end, so it is told again.
    const beforeRetry = async () => {
      throwIfCanceled();
      if (needsUi) {
        await ensureUiStarted(ctxBase, uiStarted);
        await ui.newContext({ storageState: acquired?.state.storageState, sessionStorage: acquired?.state.sessionStorage });
      }
      tellSetup();
      return attemptBase();
    };

    tellSetup();
    try {
      await engine.runScenario(scenario, attemptBase(), [], beforeRetry);
      passed += 1;
      outcomes.set(scenario.id, "passed");
    } catch (error) {
      failed += 1;
      outcomes.set(scenario.id, "failed");
      runError ??= error;
      throwIfCanceled();
      // failFast (the default) stops the run here. Otherwise keep going: the first failure is rethrown at the end.
      if (opts.failFast !== false) return "stop";
    }
    return "next";
  };

  /** Shared setups already torn down, so none runs twice. */
  const tornDown = new Set<string>();
  let inFlight: ScenarioSpec | undefined;

  /**
   * Runs one teardown in a new context seeded with the state it is due from. Never throws and never changes a
   * scenario's status or the totals: a failure is reported through onTeardownEnd only.
   */
  const runTeardown = async (due: TeardownDue, forScenarioId: string): Promise<void> => {
    const setup = setups.get(due.setupId);
    if (!setup?.teardown?.length) return;
    const started = Date.now();
    let error: unknown;
    try {
      await runSteps({ kind: "teardown", setup, steps: setup.teardown, attempt: 1, forScenarioId, startFrom: due.state });
    } catch (e) {
      error = e;
    }
    // A canceled run closed its browser: report nothing for a teardown the cancel cut off.
    if (opts.signal?.aborted) return;
    try {
      reporter.onTeardownEnd?.({
        setupId: due.setupId,
        ok: error === undefined,
        durationMs: Date.now() - started,
        ...(error !== undefined ? { error } : {}),
      });
    } catch {
      // A reporter failure must not change the run.
    }
  };

  /** Teardowns due after `scenario` (at `index`), none when the run was canceled. */
  const tearDownAfter = async (scenario: ScenarioSpec, index: number | undefined): Promise<void> => {
    if (opts.signal?.aborted) return;
    for (const due of manager.takeConsumerTeardowns(scenario.id)) {
      if (opts.signal?.aborted) return;
      await runTeardown(due, scenario.id);
    }
    if (index === undefined) return;
    await tearDownRunScoped((setupId) => lastConsumerIndex.get(setupId) === index, scenario.id);
  };

  /** Teardowns of the shared setups `due` picks, children first; every run of a setup, each setup only once. */
  const tearDownRunScoped = async (due: (setupId: string) => boolean, forScenarioId: string): Promise<void> => {
    const picked = manager.ranWithTeardown().filter((d) => !tornDown.has(d.setupId) && due(d.setupId));
    for (const d of picked) tornDown.add(d.setupId);
    for (const d of picked) {
      if (opts.signal?.aborted) return;
      await runTeardown(d, forScenarioId);
    }
  };

  try {
    // Scenarios that cannot run fail with the reason, and the run goes on.
    for (const scenario of invalid) {
      const failure = new Error(scenarioErrors.get(scenario.id));
      reporter.onScenarioStart(scenario);
      reporter.onScenarioEnd(scenario, { ok: false, error: failure, durationMs: 0 });
      failed += 1;
      runError ??= failure;
      outcomes.set(scenario.id, "failed");
    }

    // One query for the whole run, after onRunStart so a failure here still reports run.end.
    secretsByScenario = await resolveSecretsByScenario([...ordered, ...planned.map(setupAsScenario)], opts.resolveSecrets);

    for (const [index, scenario] of ordered.entries()) {
      inFlight = scenario;
      const next = await runOne(scenario);
      // After each scenario, whatever its outcome: its own teardowns (children first), then the shared setups
      // it was the last consumer of.
      await tearDownAfter(scenario, index);
      inFlight = undefined;
      if (next === "stop") break;
    }
    if (runError) throw runError;
    if (blocked > 0) {
      throw new Error(`${blocked} scenario${blocked === 1 ? " was" : "s were"} blocked, so the run did not complete`);
    }
  } catch (error) {
    // Also catches a failure before the loop (unreachable database, absent encryption key), which would otherwise
    // leave runError unset and report ok: true.
    runError = error;
    throw error;
  } finally {
    // The run stopped early (failFast, an error) or finished: tear down what is still up. A canceled run skips this.
    if (!opts.signal?.aborted) {
      // The scenario whose runOne threw still has its own teardowns to run.
      if (inFlight) await tearDownAfter(inFlight, undefined);
      await tearDownRunScoped(() => true, ordered[ordered.length - 1]?.id ?? "");
    }
    reporter.onRunEnd?.({
      ok: !runError && failed === 0 && blocked === 0,
      total: reported.length,
      passed,
      failed,
      blocked,
      durationMs: Date.now() - startedAt,
    });
    opts.signal?.removeEventListener("abort", closeOnCancel);
    await finishMedia({
      opts,
      reporter,
      ui,
      // The UI setups count as browser use. Their contexts are not filmed, so a run whose only browser use was a setup has
      // no video; its step log and error explain the failure.
      scenarios: [...ordered, ...planned.filter(isUiSetup).map(setupAsScenario)],
      outcomes,
      runError,
      uiStarted,
      mobileStarted: { value: false },
      uiClosedOnCancel,
      mobileClosedOnCancel: false,
    });
  }
}
