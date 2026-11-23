import { runLegacy } from "./run-legacy";
import type { RunnerOptions } from "./run-shared";

/**
 * Runs UI and API scenarios independently: each starts from its own browser context and variable store.
 * Until R7 this still runs the legacy loop, so every run behaves as before.
 */
export async function runIndependent(opts: RunnerOptions): Promise<void> {
  return runLegacy(opts);
}
