import type { SetupSpec, StepBlock } from "../contracts/testing-metadata.types";
import type { Reporter } from "../reporter/reporter.types";
import { setupHash } from "./setup-graph";
import type { SessionKey, SessionStore, SetupState } from "./session-store";

export class SetupFailedError extends Error {
  constructor(
    readonly setupId: string,
    message: string,
  ) {
    super(message);
    this.name = "SetupFailedError";
  }
}

export interface SetupManagerDeps {
  /** Valid setups only, keyed by id (the first setup with an id wins). */
  setups: Map<string, SetupSpec>;
  store: SessionStore;
  applicationKey: string;
  /** Runs a setup's (or teardown's, or ready's) steps. Supplied by run-independent.ts. */
  runSteps: (args: {
    kind: "setup" | "ready" | "teardown";
    setup: SetupSpec;
    steps: StepBlock[];
    attempt: number;
    forScenarioId: string;
    /** State to start from: a new context seeded with it (ui/mixed) and a resource store seeded with its exports. */
    startFrom?: SetupState;
    /** For kind "ready": run in the consumer's already-open context instead of a new one. */
    inCurrentContext?: boolean;
  }) => Promise<{ state?: SetupState; resources: Record<string, unknown> }>;
  reporter: Reporter;
}

export interface AcquireResult {
  /** A private copy: the consumer may change it without affecting the cached state or any other consumer. */
  state: SetupState;
  reused: boolean;
  durationMs: number;
}

/** A setup acquisition whose teardown is due, with the state to run teardown from. */
export interface TeardownDue {
  setupId: string;
  state: SetupState;
}

const MAX_ATTEMPTS = 2;
const ENVIRONMENT_KEY = "default";

/** One instance per run. Runs setups, caches their state and answers "give me the state for this consumer". */
export class SetupManager {
  private readonly hashes = new Map<string, string>();
  private readonly failed = new Map<string, string>();
  /**
   * Run-scoped setups that ran and have teardown steps, in the order each first ran (a parent always before its
   * children), with every state they ran to: one per run, so a re-run after a failed ready check does not lose the
   * earlier run's teardown.
   */
  private readonly pendingTeardown = new Map<string, SetupState[]>();
  /** Per consumer: scope "scenario" or fresh acquisitions (parents included) that have teardown steps. */
  private readonly consumerTeardowns = new Map<string, TeardownDue[]>();

  constructor(private readonly deps: SetupManagerDeps) {
    for (const id of deps.setups.keys()) this.hashes.set(id, setupHash(id, deps.setups));
  }

  /** State for a consumer. Throws SetupFailedError when the setup (or a parent) cannot be brought up. */
  async acquire(
    setupId: string,
    opts: { forScenarioId: string; fresh: boolean },
  ): Promise<AcquireResult> {
    const failure = this.failed.get(setupId);
    if (failure !== undefined) throw new SetupFailedError(setupId, failure);

    const setup = this.requireSetup(setupId);
    const key = this.keyFor(setup);
    const { forScenarioId } = opts;

    if (setup.scope === "run" && !opts.fresh) {
      const cached = this.deps.store.get(key);
      if (cached !== undefined) {
        this.deps.reporter.onSetupEnd?.({
          setupId,
          attempt: 0,
          ok: true,
          durationMs: 0,
          reused: true,
          forScenarioId,
        });
        return { state: cloneState(cached), reused: true, durationMs: 0 };
      }
    }

    // A parent failure rethrows: the consumer is blocked by the parent, the parent is already marked failed.
    const parent =
      setup.from !== undefined
        ? await this.acquire(setup.from, { forScenarioId, fresh: false })
        : undefined;

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      this.deps.reporter.onSetupStart?.({ setupId, attempt, forScenarioId });
      const attemptStarted = Date.now();
      let result: Awaited<ReturnType<SetupManagerDeps["runSteps"]>>;
      try {
        result = await this.deps.runSteps({
          kind: "setup",
          setup,
          steps: setup.steps,
          attempt,
          forScenarioId,
          startFrom: parent?.state,
        });
      } catch (error) {
        lastError = error;
        this.deps.reporter.onSetupEnd?.({
          setupId,
          attempt,
          ok: false,
          durationMs: Date.now() - attemptStarted,
          error: messageOf(error),
          reused: false,
          forScenarioId,
        });
        continue;
      }
      this.deps.reporter.onSetupEnd?.({
        setupId,
        attempt,
        ok: true,
        durationMs: Date.now() - attemptStarted,
        reused: false,
        forScenarioId,
      });

      const exports: Record<string, unknown> = { ...parent?.state.exports };
      for (const name of setup.exports ?? []) {
        if (name in result.resources) exports[name] = result.resources[name];
      }
      // Browser state from the parent carries over when this setup did not change it.
      const state: SetupState = {
        storageState: result.state?.storageState ?? parent?.state.storageState,
        sessionStorage: result.state?.sessionStorage ?? parent?.state.sessionStorage,
        exports,
      };

      const hasTeardown = (setup.teardown?.length ?? 0) > 0;
      if (setup.scope === "run" && !opts.fresh) {
        this.deps.store.set(key, cloneState(state));
        if (hasTeardown) {
          const states = this.pendingTeardown.get(setupId) ?? [];
          states.push(cloneState(state));
          this.pendingTeardown.set(setupId, states);
        }
      } else if (hasTeardown) {
        const due = this.consumerTeardowns.get(forScenarioId) ?? [];
        due.push({ setupId, state: cloneState(state) });
        this.consumerTeardowns.set(forScenarioId, due);
      }
      return { state: cloneState(state), reused: false, durationMs: Date.now() - attemptStarted };
    }

    const message = `Setup "${setup.name}" failed: ${firstLine(messageOf(lastError))}`;
    this.markFailed(setupId, message);
    throw new SetupFailedError(setupId, message);
  }

  /**
   * Drop a run-scoped setup's cached state, and its parents', so the next acquire runs them again (used after a
   * failed ready check: the consumer's state was built on the whole chain, and a stale parent session would break
   * the re-run too).
   */
  invalidate(setupId: string): void {
    const seen = new Set<string>();
    for (let id: string | undefined = setupId; id !== undefined && !seen.has(id); ) {
      seen.add(id);
      const setup = this.deps.setups.get(id);
      if (setup === undefined) return;
      this.deps.store.delete(this.keyFor(setup));
      id = setup.from;
    }
  }

  /** Mark a setup failed for the rest of the run; later acquires throw at once. */
  markFailed(setupId: string, error: string): void {
    this.failed.set(setupId, error);
  }

  /**
   * Run-scoped setups that ran in this run and have teardown steps, with the state to run teardown from: children
   * before their parents, and for a setup that ran more than once (re-run after a failed ready check) one entry per
   * run, newest first.
   */
  ranWithTeardown(): TeardownDue[] {
    return Array.from(this.pendingTeardown)
      .reverse()
      .flatMap(([setupId, states]) => [...states].reverse().map((state) => ({ setupId, state: cloneState(state) })));
  }

  /**
   * Scope "scenario" and fresh acquisitions made for this consumer (scope "scenario" parents included) that have
   * teardown steps, newest first (children before their parents). Includes acquisitions made before a later setup in
   * the chain failed, and every re-acquire after a failed ready check. Clears the list: call it once per consumer,
   * right after the consumer (R8).
   */
  takeConsumerTeardowns(forScenarioId: string): TeardownDue[] {
    const due = this.consumerTeardowns.get(forScenarioId) ?? [];
    this.consumerTeardowns.delete(forScenarioId);
    return due.reverse();
  }

  private requireSetup(setupId: string): SetupSpec {
    const setup = this.deps.setups.get(setupId);
    if (setup === undefined) throw new SetupFailedError(setupId, `Unknown setup "${setupId}"`);
    return setup;
  }

  private keyFor(setup: SetupSpec): SessionKey {
    return {
      applicationKey: this.deps.applicationKey,
      environmentKey: ENVIRONMENT_KEY,
      setupId: setup.id,
      setupHash: this.hashes.get(setup.id) ?? setupHash(setup.id, this.deps.setups),
    };
  }
}

/** Deep copy, so no consumer shares a mutable object (exports, storage state) with the cache or another consumer. */
function cloneState(state: SetupState): SetupState {
  return structuredClone(state);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function firstLine(text: string): string {
  return text.split("\n")[0];
}
