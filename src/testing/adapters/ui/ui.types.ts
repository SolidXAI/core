/**
 * Per-run capture toggles for the Playwright adapter. Console/network events are
 * buffered while a scenario runs and only flushed (attached to the reporter) when the
 * scenario FAILS; passing scenarios discard them. API scenarios never open a page, so
 * nothing is captured. The whole-run video may be enabled per run and is kept only when
 * the run fails.
 */
export interface CaptureOptions {
  console?: boolean;
  network?: boolean;
}

export interface PlaywrightAdapterOptions {
  headless?: boolean;
  baseUrl?: string;
  defaultTimeoutMs?: number;
  navigationTimeoutMs?: number;
  capture?: CaptureOptions;
  recordVideo?: boolean;
}
