import type { Browser, BrowserContext, Page, ConsoleMessage, Response, Request } from "playwright";

import type { CaptureOptions, PlaywrightAdapterOptions } from "./ui.types";

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export const DEFAULT_UI_TIMEOUT_MS = 30_000;
/** Keep the buffers bounded so a chatty page can't grow memory without limit. */
const MAX_CONSOLE_ENTRIES = 500;
const MAX_NETWORK_ENTRIES = 500;
const MAX_NETWORK_BODY_CHARS = 16_000;
const STATIC_EXT_RE = /\.(?:css|js|mjs|cjs|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|otf|mp4|webm|mp3|wav|pdf|zip)$/i;

export interface ConsoleLogEntry {
  type: string;
  text: string;
  location?: string;
}

export interface NetworkLogEntry {
  method: string;
  url: string;
  resourceType?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  status?: number;
  ok?: boolean;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  durationMs?: number;
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
  private readonly recordVideo: boolean;
  private browser?: Browser;
  private context?: BrowserContext;
  public page?: Page;

  /** Per-scenario ring buffers; reset via {@link resetCapture} at each scenario start. */
  private consoleBuf: ConsoleLogEntry[] = [];
  private networkBuf: NetworkLogEntry[] = [];

  /** Whole-run video: temp dir Playwright writes the webm into, and the finalized bytes. */
  private videoDir?: string;
  private runVideo?: FailureArtifact;
  private readonly requestStartedAt = new Map<Request, number>();

  constructor(opts?: PlaywrightAdapterOptions) {
    this.baseUrl = opts?.baseUrl;
    this.headless = opts?.headless ?? true;
    this.defaultTimeoutMs = opts?.defaultTimeoutMs ?? DEFAULT_UI_TIMEOUT_MS;
    this.navigationTimeoutMs =
      opts?.navigationTimeoutMs ?? this.defaultTimeoutMs;
    this.capture = opts?.capture ?? {};
    this.recordVideo = opts?.recordVideo ?? true;
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
    // Record a whole-run video only when this run enables it; it is still only KEPT when
    // the run fails (see stop({ keepVideo }) / the runner). The temp dir has to exist
    // before the context is created, since recordVideo is a context-creation option.
    if (this.recordVideo) {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');
      this.videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'solid-run-video-'));
    }
    this.context = await this.browser.newContext(
      this.videoDir ? { recordVideo: { dir: this.videoDir } } : {},
    );
    this.context.setDefaultTimeout(this.defaultTimeoutMs);
    this.context.setDefaultNavigationTimeout(this.navigationTimeoutMs);
    this.page = await this.context.newPage();
    this.attachCaptureListeners(this.page);
  }

  /** Whole-run video, available after {@link stop} has finalized the recording. */
  getRunVideo(): FailureArtifact | undefined {
    return this.runVideo;
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
      page.on("request", (req: Request) => {
        this.requestStartedAt.set(req, Date.now());
      });
      page.on("response", async (res: Response) => {
        if (this.networkBuf.length >= MAX_NETWORK_ENTRIES) return;
        const req = res.request();
        const captureDetail = shouldCaptureDetailedNetworkEntry(req);
        const requestHeaders = captureDetail ? await req.allHeaders().catch(() => undefined) : undefined;
        const responseHeaders = captureDetail ? await res.allHeaders().catch(() => undefined) : undefined;
        const responseBody = captureDetail ? await this.readResponseBody(res, responseHeaders) : undefined;
        const startedAt = this.requestStartedAt.get(req);
        this.requestStartedAt.delete(req);
        this.networkBuf.push({
          method: req.method(),
          url: res.url(),
          resourceType: req.resourceType(),
          requestHeaders,
          requestBody: captureDetail ? truncateText(req.postData() ?? undefined) : undefined,
          status: res.status(),
          ok: res.ok(),
          responseHeaders,
          responseBody,
          durationMs: startedAt != null ? Date.now() - startedAt : undefined,
        });
      });
      page.on("requestfailed", async (req: Request) => {
        if (this.networkBuf.length >= MAX_NETWORK_ENTRIES) return;
        const startedAt = this.requestStartedAt.get(req);
        this.requestStartedAt.delete(req);
        const captureDetail = shouldCaptureDetailedNetworkEntry(req);
        this.networkBuf.push({
          method: req.method(),
          url: req.url(),
          resourceType: req.resourceType(),
          requestHeaders: captureDetail ? await req.allHeaders().catch(() => undefined) : undefined,
          requestBody: captureDetail ? truncateText(req.postData() ?? undefined) : undefined,
          failure: req.failure()?.errorText ?? "request failed",
          durationMs: startedAt != null ? Date.now() - startedAt : undefined,
        });
      });
    }
  }

  /** Clear the per-scenario buffers. Called by the engine at each scenario start. */
  resetCapture(): void {
    this.consoleBuf = [];
    this.networkBuf = [];
    this.requestStartedAt.clear();
  }

  getConsoleLog(): ConsoleLogEntry[] {
    return this.consoleBuf;
  }

  getNetworkLog(): NetworkLogEntry[] {
    return this.networkBuf;
  }

  private async readResponseBody(res: Response, headers?: Record<string, string>): Promise<string | undefined> {
    const contentType = String(headers?.["content-type"] ?? headers?.["Content-Type"] ?? "").toLowerCase();
    const contentLength = Number(headers?.["content-length"] ?? headers?.["Content-Length"] ?? 0);
    if (contentLength && contentLength > MAX_NETWORK_BODY_CHARS) {
      return `[body omitted: ${contentLength} bytes]`;
    }
    if (!isTextLikeContentType(contentType)) return undefined;
    try {
      return truncateText(await res.text());
    } catch {
      return undefined;
    }
  }

  /**
   * Build the text artifacts to attach when the current scenario has FAILED (console +
   * network logs). Honors this adapter's capture flags. Returns an empty list when no page
   * is open (e.g. an API scenario). Failure screenshots were removed — the whole-run video
   * (kept only on failure) is the visual failure artifact now.
   */
  async collectFailureArtifacts(): Promise<FailureArtifact[]> {
    if (!this.page) return [];
    const artifacts: FailureArtifact[] = [];

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

  async stop(opts?: { keepVideo?: boolean }): Promise<void> {
    const keepVideo = opts?.keepVideo ?? false;
    // Grab the video handle before the context closes; its file is only finalized on close().
    const video = this.videoDir ? this.page?.video() : undefined;

    try {
      if (this.context) {
        await this.context.close();
      }
    } finally {
      this.context = undefined;
      this.page = undefined;
    }

    if (video && this.videoDir) {
      try {
        const fs = await import('fs');
        // Only read the recording into memory when the caller wants to keep it (i.e. the
        // run FAILED). Passing runs discard the webm unread — no wasted IO/memory.
        if (keepVideo) {
          const videoPath = await video.path();
          const data = await fs.promises.readFile(videoPath);
          this.runVideo = { name: 'run.webm', contentType: 'video/webm', data };
        }
        // Clean up the temp recording directory either way.
        await fs.promises.rm(this.videoDir, { recursive: true, force: true }).catch(() => {});
      } catch {
        // A video read failure must never mask the real run result.
      } finally {
        this.videoDir = undefined;
      }
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
      // Treat the configured base as a prefix and keep it whole, matching how
      // the API adapter combines axios `baseURL` with a relative url. Resolving
      // through `new URL()` follows RFC 3986 and discards any path on the base,
      // so an application registered at https://host/myapp would send "/login"
      // to https://host/login instead of https://host/myapp/login.
      return `${this.baseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
    }
    return url;
  }
}

function truncateText(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.length <= MAX_NETWORK_BODY_CHARS) return value;
  return `${value.slice(0, MAX_NETWORK_BODY_CHARS)}\n… [truncated ${value.length - MAX_NETWORK_BODY_CHARS} chars]`;
}

function isTextLikeContentType(contentType: string): boolean {
  if (!contentType) return true;
  return (
    contentType.includes("json") ||
    contentType.includes("text/") ||
    contentType.includes("javascript") ||
    contentType.includes("xml") ||
    contentType.includes("html") ||
    contentType.includes("x-www-form-urlencoded")
  );
}

function shouldCaptureDetailedNetworkEntry(req: Request): boolean {
  const resourceType = req.resourceType().toLowerCase();
  if (resourceType === "xhr" || resourceType === "fetch") return true;

  const method = req.method().toUpperCase();
  if (method !== "GET" && method !== "HEAD") return true;

  const url = req.url().toLowerCase();
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (STATIC_EXT_RE.test(pathname)) return false;
  } catch {
    if (STATIC_EXT_RE.test(url)) return false;
  }

  return resourceType === "document";
}
