import { runLegacy } from "./run-legacy";
import { runIndependent } from "./run-independent";
import { scenarioNeedsMobile } from "./lifecycle";
import type { RunnerOptions } from "./run-shared";

export { buildTestDataIndex } from "./run-shared";
export type { RunnerOptions } from "./run-shared";

export async function runFromMetadata(opts: RunnerOptions): Promise<void> {
  const all = opts.scenarios ?? opts.metadata?.testing?.scenarios ?? [];
  // Mobile keeps the legacy model until the mobile follow-up. Any run that contains a mobile scenario, or a scenario with mobile.* steps, runs on it.
  if (all.some((s) => s && scenarioNeedsMobile(s))) return runLegacy(opts);
  return runIndependent(opts);
}
