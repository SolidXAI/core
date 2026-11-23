import type { Reporter } from "../reporter/reporter.types";
import type { TestingDataRecord, ScenarioSpec, SetupSpec, TestingMetadata } from "../contracts/testing-metadata.types";
import type { ApiAdapterOptions } from "../adapters/api/api.types";
import type { PlaywrightAdapterOptions } from "../adapters/ui/ui.types";
import type { MobileAdapterOptions } from "../adapters/mobile/mobile.types";
import type { MobileAdapter } from "../adapters/mobile/mobile-adapter";
import type { PlaywrightAdapter as UiAdapter } from "../adapters/ui/playwright-adapter";
import type { SpecRegistry } from "../core/spec-registry";
import { collectSecretKeys } from "../core/interpolation";
import { scenarioNeedsUi } from "./lifecycle";

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
  /** Setups come from here, else from `metadata.testing.setups`. */
  setups?: SetupSpec[];
  /** "file" (default) keeps file order; "shuffle" randomises it with shuffleSeed. */
  order?: "file" | "shuffle";
  /** Seed for order "shuffle". Generated and reported in run.start when absent. */
  shuffleSeed?: string;
  /** Identifies the application for the session store key. Defaults to "local". */
  applicationKey?: string;
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
   * Stop the run at the first failed scenario (default `true`), also in a run with dependencies
   * (dependsOn / restoreFrom / session). When `false`, every scenario runs — a failed one's dependents
   * are skipped — and the run still throws after the last one if any failed.
   */
  failFast?: boolean;
  /**
   * Which runs keep their whole-run video. `"failed"` (default) keeps it only for a failed run; `"always"` keeps it
   * for every run that used the browser or a device. A canceled run never keeps it.
   */
  keepVideo?: "failed" | "always";
  specs?: (registry: SpecRegistry) => void;
  /**
   * Resolves `${secret:...}` references against the secret store. Injected by the
   * caller so this runner stays free of database and DI coupling. Required only if a
   * scenario actually references a secret.
   */
  resolveSecrets?: (keys: string[]) => Promise<Record<string, any>>;
  /**
   * Aborting this stops the run: the browser (or device session) is closed at once, so a step in flight fails
   * and the window disappears, and no further scenario starts. The caller gets a RunCanceledError.
   */
  signal?: AbortSignal;
};

/**
 * Resolves every secret referenced by the scenarios about to run, in one call, and
 * returns a per-scenario view of the result.
 *
 * Partitioned deliberately: ctxBase is shared across scenarios, so handing every
 * scenario the whole map would let each read secrets belonging to the others.
 */
export async function resolveSecretsByScenario(
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

export type FinishMediaArgs = {
  opts: RunnerOptions;
  reporter: Reporter;
  ui: UiAdapter;
  mobile?: MobileAdapter;
  /** The scenarios the run executed, used to decide whether the browser video is kept. */
  scenarios: ScenarioSpec[];
  outcomes: Map<string, string>;
  runError: unknown;
  uiStarted: { value: boolean };
  mobileStarted: { value: boolean };
  /** True when the cancel handler already stopped the browser / device, so it is not stopped twice. */
  uiClosedOnCancel: boolean;
  mobileClosedOnCancel: boolean;
};

/** Stops the browser and device and attaches their whole-run videos (and the timeline) as run artifacts. */
export async function finishMedia(args: FinishMediaArgs): Promise<void> {
  const { opts, reporter, ui, mobile, scenarios, outcomes, runError, uiStarted, mobileStarted, uiClosedOnCancel, mobileClosedOnCancel } = args;
  if (uiStarted.value && !uiClosedOnCancel) {
    // By default only KEEP the whole-run video when the run FAILED in the browser — passing runs, and runs where
    // only API scenarios failed (nothing of theirs is on screen), discard it unread. With keepVideo "always" every
    // run that has a browser scenario keeps it.
    const keepVideo =
      opts.keepVideo === "always"
        ? scenarios.some((s) => scenarioNeedsUi(s))
        : !!runError && scenarios.some((s) => scenarioNeedsUi(s) && outcomes.get(s.id) === "failed");
    await ui.stop({ keepVideo });
    // Video bytes are only finalized after ui.stop(); attach it as a run-level artifact so
    // the reporter uploads it and references it on run.end (queued before flushPending runs).
    if (keepVideo && reporter.attachRunArtifact) {
      for (const video of ui.getRunVideos()) {
        reporter.attachRunArtifact({ name: video.name, contentType: video.contentType, data: video.data });
      }
      // Where each scenario is in the video, for the run page to jump to.
      const timeline = ui.getRunVideoTimeline();
      if (timeline) {
        reporter.attachRunArtifact({ name: "run-timeline.json", contentType: "application/json", data: JSON.stringify(timeline) });
      }
    }
  }
  if (mobile && mobileStarted.value && !mobileClosedOnCancel) {
    // Same policy as the browser video: keep the recording when the run failed, or for every run with "always".
    const keepVideo = opts.keepVideo === "always" || !!runError;
    await mobile.stop({ keepVideo });
    if (keepVideo) {
      const video = mobile.getRunVideo();
      if (video && reporter.attachRunArtifact) {
        reporter.attachRunArtifact({ name: video.name, contentType: video.contentType, data: video.data });
      }
    }
  }
}
