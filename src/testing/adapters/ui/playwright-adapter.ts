import type { Browser, BrowserContext, Page } from "playwright";

import type { PlaywrightAdapterOptions } from "./ui.types";

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export const DEFAULT_UI_TIMEOUT_MS = 30_000;

export class PlaywrightAdapter {
  private readonly baseUrl?: string;
  private readonly headless: boolean;
  private readonly defaultTimeoutMs: number;
  private readonly navigationTimeoutMs: number;
  private browser?: Browser;
  private context?: BrowserContext;
  public page?: Page;

  constructor(opts?: PlaywrightAdapterOptions) {
    this.baseUrl = opts?.baseUrl;
    this.headless = opts?.headless ?? true;
    this.defaultTimeoutMs = opts?.defaultTimeoutMs ?? DEFAULT_UI_TIMEOUT_MS;
    this.navigationTimeoutMs =
      opts?.navigationTimeoutMs ?? this.defaultTimeoutMs;
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
