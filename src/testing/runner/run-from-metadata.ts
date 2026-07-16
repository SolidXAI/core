import type { Reporter } from "../reporter/reporter.types";
import type { TestingMetadata, TestingDataRecord, ScenarioSpec } from "../contracts/testing-metadata.types";
import type { ApiAdapterOptions } from "../adapters/api/api.types";
import type { PlaywrightAdapterOptions } from "../adapters/ui/ui.types";
import { ApiAdapter } from "../adapters/api/api-adapter";
import { registerApiSteps } from "../steps/api";
import { registerUiSteps } from "../steps/ui";
import { registerAssertSteps } from "../steps/assert";
import { registerUtilSteps } from "../steps/util";
import { registerTestSteps } from "../steps/test";
import { SimpleResourceStore } from "../core/resource-store";
import { StepRegistry } from "../core/step-registry";
import { SpecRegistry } from "../core/spec-registry";
import { TestingEngine } from "../core/testing-engine";
import { filterScenarios } from "./scenario-filter";
import { ensureUiStarted, scenarioNeedsUi } from "./lifecycle";
import { ConsoleReporter } from "../reporter/console-reporter";


function buildTestDataIndex(data?: TestingDataRecord[]): Record<string, Record<string, any>> {
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
  defaults?: { timeoutMs?: number; retries?: number };
  options?: { printApiLogs?: boolean };
  specs?: (registry: SpecRegistry) => void;
};

export async function runFromMetadata(opts: RunnerOptions): Promise<void> {
  const startedAt = Date.now();
  const registry = new StepRegistry();
  registerApiSteps(registry);
  registerUiSteps(registry);
  registerAssertSteps(registry);
  registerUtilSteps(registry);
  registerTestSteps(registry);

  const engine = new TestingEngine(registry, opts.defaults);
  const allScenarios = opts.scenarios ?? opts.metadata?.testing?.scenarios ?? [];
  const scenarios = filterScenarios(allScenarios, {
    scenarioIds: opts.scenarioIds,
    includeTags: opts.includeTags,
    skipScenarioIds: opts.skipScenarioIds,
  });

  const specRegistry = new SpecRegistry();
  const testData = buildTestDataIndex(opts.data ?? opts.metadata?.testing?.data);
  if (opts.specs) {
    opts.specs(specRegistry);
  }

  const resources = new SimpleResourceStore();
  const reporter: Reporter = opts.reporter ?? new ConsoleReporter();
  const api = new ApiAdapter(opts.api);
  const { PlaywrightAdapter } = await import("../adapters/ui/playwright-adapter");
  const ui = new PlaywrightAdapter(opts.ui);
  const ctxBase = { resources, reporter, api, ui, specRegistry, testData, env: opts.env, options: opts.options };
  const uiStarted = { value: false };
  let passed = 0;
  let failed = 0;
  let runError: unknown;

  reporter.onRunStart?.({
    total: scenarios.length,
    startedAt: new Date(startedAt).toISOString(),
    scenarioIds: scenarios.map((s) => s.id),
  });

  try {
    for (const scenario of scenarios) {
      if (scenarioNeedsUi(scenario)) {
        await ensureUiStarted(ctxBase, uiStarted);
      }
      try {
        await engine.runScenario(scenario, ctxBase);
        passed += 1;
      } catch (error) {
        failed += 1;
        runError = error;
        throw error;
      }
    }
  } finally {
    reporter.onRunEnd?.({
      ok: !runError,
      total: scenarios.length,
      passed,
      failed,
      durationMs: Date.now() - startedAt,
    });
    if (uiStarted.value) {
      // Only KEEP the whole-run video when the run FAILED — passing runs discard it unread.
      const keepVideo = !!runError;
      await ui.stop({ keepVideo });
      // Video bytes are only finalized after ui.stop(); attach it as a run-level artifact so
      // the reporter uploads it and references it on run.end (queued before flushPending runs).
      if (keepVideo) {
        const video = ui.getRunVideo?.();
        if (video && reporter.attachRunArtifact) {
          reporter.attachRunArtifact({ name: video.name, contentType: video.contentType, data: video.data });
        }
      }
    }
  }
}
