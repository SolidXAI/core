import { runLegacy } from "./run-legacy";
import { runIndependent } from "./run-independent";
import type { RunnerOptions } from "./run-shared";

export { buildTestDataIndex } from "./run-shared";
export type { RunnerOptions } from "./run-shared";

export async function runFromMetadata(opts: RunnerOptions): Promise<void> {
  const all = opts.scenarios ?? opts.metadata?.testing?.scenarios ?? [];
  // Mobile keeps the legacy model until the mobile follow-up. Any run that contains a mobile scenario runs on it.
  if (all.some((s) => s?.type === "mobile")) return runLegacy(opts);
  return runIndependent(opts);
}
