import type { Reporter } from "../reporter/reporter.types";
import type { TestingMetadata, TestingDataRecord } from "../contracts/testing-metadata.types";
import type { ApiAdapterOptions } from "../adapters/api/api.types";
import type { PlaywrightAdapterOptions } from "../adapters/ui/ui.types";
import { ApiAdapter } from "../adapters/api/api-adapter";
import { PlaywrightAdapter } from "../adapters/ui/playwright-adapter";
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
  metadata: TestingMetadata;
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
  const registry = new StepRegistry();
  registerApiSteps(registry);
  registerUiSteps(registry);
  registerAssertSteps(registry);
  registerUtilSteps(registry);
  registerTestSteps(registry);

  const engine = new TestingEngine(registry, opts.defaults);
  const scenarios = filterScenarios(opts.metadata.testing.scenarios, {
    scenarioIds: opts.scenarioIds,
    includeTags: opts.includeTags,
    skipScenarioIds: opts.skipScenarioIds,
  });

  const specRegistry = new SpecRegistry();
  const testData = buildTestDataIndex(opts.metadata.testing?.data);
  if (opts.specs) {
    opts.specs(specRegistry);
  }

  const resources = new SimpleResourceStore();
  const reporter = opts.reporter ?? new ConsoleReporter();
  const api = new ApiAdapter(opts.api);
  const ui = new PlaywrightAdapter(opts.ui);
  const ctxBase = { resources, reporter, api, ui, specRegistry, testData, options: opts.options };
  const uiStarted = { value: false };

  try {
    for (const scenario of scenarios) {
      if (scenarioNeedsUi(scenario)) {
        await ensureUiStarted(ctxBase, uiStarted);
      }
      await engine.runScenario(scenario, ctxBase);
    }
  } finally {
    if (uiStarted.value) {
      await ui.stop();
    }
  }
}
