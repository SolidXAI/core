import type { Browser, BrowserContext, Page } from "playwright";

import type { PlaywrightAdapterOptions } from "./ui.types";

const DEFAULT_MOBILE_VIEWPORT = { width: 412, height: 915 };
const DEFAULT_MOBILE_DEVICE_SCALE_FACTOR = 2.625;

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export class PlaywrightAdapter {
  private readonly baseUrl?: string;
  private readonly headless: boolean;
  private readonly mobile: boolean;
  private readonly viewport?: { width: number; height: number };
  private browser?: Browser;
  private context?: BrowserContext;
  public page?: Page;

  constructor(opts?: PlaywrightAdapterOptions) {
    this.baseUrl = opts?.baseUrl;
    this.headless = opts?.headless ?? true;
    this.mobile = opts?.mobile ?? false;
    this.viewport = opts?.viewport;
  }

  isHeadless(): boolean {
    return this.headless;
  }

  isMobile(): boolean {
    return this.mobile;
  }

  async start(): Promise<void> {
    const { chromium } = await import("playwright");
    this.browser = await chromium.launch({ headless: this.headless });
    const mobileViewport = this.mobile
      ? (this.viewport ?? DEFAULT_MOBILE_VIEWPORT)
      : this.viewport;
    this.context = await this.browser.newContext({
      // Keep "mobile" aligned with the CLI meaning: mobile-sized viewport only.
      // We still mirror the screen size and DPR so layout code that reads screen metrics
      // behaves closer to a real handheld device without switching UA/touch semantics.
      viewport: mobileViewport,
      screen: mobileViewport,
      deviceScaleFactor: this.mobile
        ? DEFAULT_MOBILE_DEVICE_SCALE_FACTOR
        : undefined,
    });
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
