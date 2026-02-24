import type { PlaywrightAdapterOptions } from "./ui.types";

// Locally-defined minimal types so playwright is not a required install-time dependency.
// The real types are loaded lazily via `import('playwright')` inside `start()`.
type Browser = { newContext(): Promise<BrowserContext>; close(): Promise<void> };
type BrowserContext = { newPage(): Promise<Page>; close(): Promise<void> };
type Page = object;

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export class PlaywrightAdapter {
  private readonly baseUrl?: string;
  private readonly headless: boolean;
  private browser?: Browser;
  private context?: BrowserContext;
  public page?: Page;

  constructor(opts?: PlaywrightAdapterOptions) {
    this.baseUrl = opts?.baseUrl;
    this.headless = opts?.headless ?? true;
  }

  async start(): Promise<void> {
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext();
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
