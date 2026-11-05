/**
 * Lets a caller stop a test run that a worker is executing, by the id it gave the run (`externalRunId`).
 *
 * The worker registers a run when it picks the job up and passes the returned signal to `runFromMetadata`;
 * `cancelTestRun` aborts that signal, which closes the browser (or device session) and stops the run before its
 * next scenario. The registry lives in memory, so it reaches runs executed by the same process as the caller,
 * which is how the queue worker runs unless it is deployed as a separate process.
 */

const running = new Map<string, AbortController>();

/** Starts tracking a run and returns the signal that is aborted when it is canceled. */
export function registerRunCancellation(externalRunId: string): AbortSignal {
  const controller = new AbortController();
  running.set(externalRunId, controller);
  return controller.signal;
}

/** Stops tracking a run once it has ended, however it ended. */
export function releaseRunCancellation(externalRunId: string): void {
  running.delete(externalRunId);
}

/** Aborts a run that is in progress. Returns false when no such run is being executed here. */
export function cancelTestRun(externalRunId: string): boolean {
  const controller = running.get(externalRunId);
  if (!controller) return false;
  controller.abort();
  return true;
}

/** Thrown inside the runner when its signal is aborted; a canceled run is not a failing test. */
export class RunCanceledError extends Error {
  constructor() {
    super("Run was canceled");
    this.name = "RunCanceledError";
  }
}
