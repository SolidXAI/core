import type { Browser, BrowserContext, Page, ConsoleMessage, Response, Request } from "playwright";

import type { CaptureOptions, PlaywrightAdapterOptions } from "./ui.types";

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export const DEFAULT_UI_TIMEOUT_MS = 30_000;
/** Keep the buffers bounded so a chatty page can't grow memory without limit. */
const MAX_CONSOLE_ENTRIES = 500;
const MAX_NETWORK_ENTRIES = 500;

export interface ConsoleLogEntry {
  type: string;
  text: string;
  location?: string;
}

export interface NetworkLogEntry {
  method: string;
  url: string;
  status?: number;
  ok?: boolean;
  failure?: string;
}

/** One artifact to hand to the reporter's `attach()` on scenario failure. */
export interface FailureArtifact {
  name: string;
  contentType: string;
  data: Buffer | string;
}

export class PlaywrightAdapter {
  private readonly baseUrl?: string;
  private readonly headless: boolean;
  private readonly defaultTimeoutMs: number;
  private readonly navigationTimeoutMs: number;
  private readonly capture: CaptureOptions;
  private browser?: Browser;
  private context?: BrowserContext;
  public page?: Page;

  /** Per-scenario ring buffers; reset via {@link resetCapture} at each scenario start. */
  private consoleBuf: ConsoleLogEntry[] = [];
  private networkBuf: NetworkLogEntry[] = [];

  constructor(opts?: PlaywrightAdapterOptions) {
    this.baseUrl = opts?.baseUrl;
    this.headless = opts?.headless ?? true;
    this.defaultTimeoutMs = opts?.defaultTimeoutMs ?? DEFAULT_UI_TIMEOUT_MS;
    this.navigationTimeoutMs =
      opts?.navigationTimeoutMs ?? this.defaultTimeoutMs;
    this.capture = opts?.capture ?? {};
  }

  isHeadless(): boolean {
    return this.headless;
  }

  /**
   * Resolves the timeout for a single Playwright call: an explicit per-step
   * value wins, otherwise the run-wide default applies.
   */
  resolveTimeout(stepTimeoutMs?: number): number {
    return typeof stepTimeoutMs === 'number' && Number.isFinite(stepTimeoutMs)
      ? stepTimeoutMs
      : this.defaultTimeoutMs;
  }

  resolveNavigationTimeout(stepTimeoutMs?: number): number {
    return typeof stepTimeoutMs === 'number' && Number.isFinite(stepTimeoutMs)
      ? stepTimeoutMs
      : this.navigationTimeoutMs;
  }

  async start(): Promise<void> {
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext();
    this.context.setDefaultTimeout(this.defaultTimeoutMs);
    this.context.setDefaultNavigationTimeout(this.navigationTimeoutMs);
    this.page = await this.context.newPage();
    this.attachCaptureListeners(this.page);
  }

  /**
   * Wire console/network listeners once per page. Events accumulate in the per-scenario
   * buffers and are only surfaced (via {@link collectFailureArtifacts}) when a scenario
   * fails — passing scenarios reset and discard them.
   */
  private attachCaptureListeners(page: Page): void {
    if (this.capture.console) {
      page.on("console", (msg: ConsoleMessage) => {
        if (this.consoleBuf.length >= MAX_CONSOLE_ENTRIES) return;
        const loc = msg.location();
        this.consoleBuf.push({
          type: msg.type(),
          text: msg.text(),
          location: loc?.url ? `${loc.url}:${loc.lineNumber ?? 0}` : undefined,
        });
      });
      page.on("pageerror", (err: Error) => {
        if (this.consoleBuf.length >= MAX_CONSOLE_ENTRIES) return;
        this.consoleBuf.push({ type: "pageerror", text: err?.stack || err?.message || String(err) });
      });
    }

    if (this.capture.network) {
      page.on("response", (res: Response) => {
        if (this.networkBuf.length >= MAX_NETWORK_ENTRIES) return;
        const req = res.request();
        this.networkBuf.push({
          method: req.method(),
          url: res.url(),
          status: res.status(),
          ok: res.ok(),
        });
      });
      page.on("requestfailed", (req: Request) => {
        if (this.networkBuf.length >= MAX_NETWORK_ENTRIES) return;
        this.networkBuf.push({
          method: req.method(),
          url: req.url(),
          failure: req.failure()?.errorText ?? "request failed",
        });
      });
    }
  }

  /** Clear the per-scenario buffers. Called by the engine at each scenario start. */
  resetCapture(): void {
    this.consoleBuf = [];
    this.networkBuf = [];
  }

  getConsoleLog(): ConsoleLogEntry[] {
    return this.consoleBuf;
  }

  getNetworkLog(): NetworkLogEntry[] {
    return this.networkBuf;
  }

  /**
   * Build the artifacts to attach when the current scenario has FAILED. Honors this
   * adapter's capture flags. Returns an empty list when no page is open (e.g. an API
   * scenario) so screenshots are correctly skipped.
   */
  async collectFailureArtifacts(): Promise<FailureArtifact[]> {
    if (!this.page) return [];
    const artifacts: FailureArtifact[] = [];

    if (this.capture.screenshotOnFailure) {
      try {
        // Viewport JPEG (not fullPage): captures the on-screen state at the failure point
        // and stays small enough to travel inline (base64) under the reporter's 1MB cap.
        const shot = await this.page.screenshot({ type: "jpeg", quality: 70 });
        artifacts.push({ name: "screenshot.jpg", contentType: "image/jpeg", data: shot });
      } catch {
        // A screenshot failure (e.g. page already closed) must never mask the real error.
      }
    }

    if (this.capture.console && this.consoleBuf.length) {
      artifacts.push({
        name: "console.json",
        contentType: "application/json",
        data: JSON.stringify(this.consoleBuf),
      });
    }

    if (this.capture.network && this.networkBuf.length) {
      artifacts.push({
        name: "network.json",
        contentType: "application/json",
        data: JSON.stringify(this.networkBuf),
      });
    }

    return artifacts;
  }

  async stop(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
      }
    } finally {
      this.context = undefined;
      this.page = undefined;
    }

    try {
      if (this.browser) {
        await this.browser.close();
      }
    } finally {
      this.browser = undefined;
    }
  }

  resolveUrl(url: string): string {
    if (isAbsoluteUrl(url)) return url;
    if (this.baseUrl) {
      return new URL(url, this.baseUrl).toString();
    }
    return url;
  }
}
