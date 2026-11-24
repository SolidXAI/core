/**
 * Lets a caller watch a run as it executes, by the id it gave the run (`externalRunId`).
 *
 * The worker looks up the run's sink when it picks the job up and passes it to `runFromMetadata`; the browser adapter
 * streams screencast frames into it, but only while `hasViewers()` is true, so a run nobody watches pays nothing.
 * The caller (Test Hub's API) registers a sink before the job starts and releases it when the run ends. Like
 * run-cancellation, the registry lives in memory, so it reaches runs executed by the same process as the caller.
 */

export interface RunLiveFrame {
  /** Base64 JPEG. */
  data: string;
  at: number;
  /** The page's URL when the frame was taken. */
  url?: string;
}

export interface RunFrameSink {
  hasViewers(): boolean;
  /** Called when viewers come or go; returns an unsubscribe. */
  onViewersChanged(cb: () => void): () => void;
  push(frame: RunLiveFrame): void;
}

const sinks = new Map<string, RunFrameSink>();

/** Makes a run's frames available to whoever watches it. */
export function registerRunFrameSink(externalRunId: string, sink: RunFrameSink): void {
  sinks.set(externalRunId, sink);
}

/** Stops tracking a run's sink once it has ended, however it ended. */
export function releaseRunFrameSink(externalRunId: string): void {
  sinks.delete(externalRunId);
}

export function getRunFrameSink(externalRunId: string): RunFrameSink | undefined {
  return sinks.get(externalRunId);
}
