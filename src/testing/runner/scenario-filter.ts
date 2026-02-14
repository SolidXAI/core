import type { ScenarioSpec } from "../contracts/testing-metadata.types";

type ScenarioFilterOptions = {
  scenarioIds?: string[];
  includeTags?: string[];
  skipScenarioIds?: string[];
};

export function filterScenarios(
  scenarios: ScenarioSpec[],
  opts: ScenarioFilterOptions,
): ScenarioSpec[] {
  let result = scenarios;

  if (opts.scenarioIds && opts.scenarioIds.length > 0) {
    const idSet = new Set(opts.scenarioIds);
    result = result.filter((scenario) => idSet.has(scenario.id));
  }

  if (opts.includeTags && opts.includeTags.length > 0) {
    result = result.filter((scenario) => {
      const tags = scenario.tags ?? [];
      return opts.includeTags!.every((tag) => tags.includes(tag));
    });
  }

  if (opts.skipScenarioIds && opts.skipScenarioIds.length > 0) {
    const skipSet = new Set(opts.skipScenarioIds);
    result = result.filter((scenario) => !skipSet.has(scenario.id));
  }

  return result;
}
