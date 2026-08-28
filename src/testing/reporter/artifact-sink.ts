/**
 * Contract for persisting binary test artifacts (screenshots, video, HAR) to shared
 * storage and returning a reference. The concrete {@link FileServiceArtifactSink}
 * (backed by the core FILE_SERVICE) is added in Phase 2 (A6). Kept as a standalone
 * interface so {@link LifecycleWebhookReporter} can depend on it without pulling in
 * Nest DI.
 */
export interface IArtifactSink {
  put(args: {
    runId: string;
    scenarioId: string;
    name: string;
    contentType: string;
    data: Buffer | NodeJS.ReadableStream;
  }): Promise<{ storageKey: string; url: string; sizeBytes: number }>;
}
