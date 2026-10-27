import type { HealingPolicy } from "../../contracts/testing-metadata.types";

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

/**
 * Browser window size for a run. `isMobile` and `hasTouch` make the page behave like a phone
 * (mobile meta-viewport handling, touch events); leave them off for a desktop-sized window.
 * Without a viewport Playwright's own default (1280x720) applies.
 */
export interface ViewportOptions {
  width: number;
  height: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  deviceScaleFactor?: number;
  /** The device's browser identity, so a site that checks it sees a phone or tablet. */
  userAgent?: string;
}

export interface PlaywrightAdapterOptions {
  headless?: boolean;
  baseUrl?: string;
  defaultTimeoutMs?: number;
  navigationTimeoutMs?: number;
  capture?: CaptureOptions;
  recordVideo?: boolean;
  /** Selector healing for UI steps; see {@link HealingPolicy}. Defaults to `report`. */
  healing?: HealingPolicy;
  viewport?: ViewportOptions;
}

/** Options for wrapping a page the caller already owns. */
export type AttachOptions = Omit<PlaywrightAdapterOptions, "headless" | "recordVideo">;
