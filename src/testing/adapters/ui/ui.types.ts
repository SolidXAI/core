/**
 * Per-run capture toggles for the Playwright adapter. Console/network events are
 * buffered while a scenario runs and only flushed (attached to the reporter) when the
 * scenario FAILS; passing scenarios discard them. `screenshotOnFailure` grabs a viewport
 * JPEG at the moment of failure. API scenarios never open a page, so nothing is captured.
 */
export interface CaptureOptions {
  console?: boolean;
  network?: boolean;
  screenshotOnFailure?: boolean;
}

export interface PlaywrightAdapterOptions {
  headless?: boolean;
  baseUrl?: string;
  defaultTimeoutMs?: number;
  navigationTimeoutMs?: number;
  capture?: CaptureOptions;
}
