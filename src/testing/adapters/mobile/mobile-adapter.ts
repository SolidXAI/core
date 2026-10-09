import { DEFAULT_UI_TIMEOUT_MS } from "../ui/playwright-adapter";
import type { FailureArtifact } from "../ui/playwright-adapter";
import { buildCapabilities } from "./capabilities";
import { resolveLocator } from "./locator";
import { toConsoleEntries } from "./logcat";
import type { ResolvedLocator } from "./locator";
import type {
  MobileAdapterOptions,
  MobileDriver,
  MobileElement,
  MobileRemoteOptions,
} from "./mobile.types";

/** Keep the device log bounded, like the UI adapter's console buffer. */
const MAX_LOGCAT_ENTRIES = 500;

/**
 * Two-thirds scale and a modest bit rate keep a run's recording small (D15). Android records at most 180 s
 * per file, so a longer limit makes Appium record in 180 s chunks. It merges them at the end when `ffmpeg`
 * is installed; without it, Appium returns the most recent chunk, which is the part that matters when a run
 * fails. With a limit of 180 the recording would stop after the first chunk and miss the failure.
 */
const RECORDING_OPTIONS = { videoSize: "720x1600", bitRate: 2_000_000, timeLimit: "1800" };

const ELEMENT_POLL_MS = 500;

/** Android app states from `mobile: queryAppState`. 4 means running in the foreground. */
const APP_STATE_FOREGROUND = 4;

async function defaultDriverFactory(options: MobileRemoteOptions): Promise<MobileDriver> {
  // The module name is a variable so TypeScript does not try to resolve this optional peer.
  const moduleName = "webdriverio";
  let mod: { remote: (opts: MobileRemoteOptions) => Promise<MobileDriver> };
  try {
    mod = await import(moduleName);
  } catch (error: any) {
    if (error?.code === "MODULE_NOT_FOUND" || error?.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        'Mobile scenarios need the "webdriverio" package. Install it in the app that runs tests: npm i webdriverio@^10.0.1',
      );
    }
    throw new Error(`Could not load "webdriverio": ${error?.message ?? error}`);
  }
  return mod.remote(options);
}

/**
 * Drives one Android device or emulator through an Appium server. Mirrors PlaywrightAdapter: one
 * session per run, shared by every mobile scenario, started lazily and stopped when the run ends.
 */
export class MobileAdapter {
  private readonly defaultTimeoutMs: number;
  private readonly navigationTimeoutMs: number;
  private readonly strictLocators: boolean;
  private readonly recordVideo: boolean;
  private readonly captureConsole: boolean;
  private readonly captureScreenshot: boolean;
  private driver?: MobileDriver;
  private recording = false;
  private runVideo?: FailureArtifact;

  /** Set when screen recording could not start; the run continues without a video. */
  public recordingError?: string;

  constructor(private readonly opts: MobileAdapterOptions) {
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_UI_TIMEOUT_MS;
    this.navigationTimeoutMs = opts.navigationTimeoutMs ?? this.defaultTimeoutMs;
    this.strictLocators = opts.strictLocators ?? true;
    this.recordVideo = opts.recordVideo ?? true;
    this.captureConsole = opts.capture?.console ?? false;
    this.captureScreenshot = opts.capture?.screenshot ?? false;
  }

  /** An explicit per-step value wins, otherwise the run-wide default applies. */
  resolveTimeout(stepTimeoutMs?: number): number {
    return typeof stepTimeoutMs === "number" && Number.isFinite(stepTimeoutMs)
      ? stepTimeoutMs
      : this.defaultTimeoutMs;
  }

  resolveNavigationTimeout(stepTimeoutMs?: number): number {
    return typeof stepTimeoutMs === "number" && Number.isFinite(stepTimeoutMs)
      ? stepTimeoutMs
      : this.navigationTimeoutMs;
  }

  isStarted(): boolean {
    return !!this.driver;
  }

  getDriver(): MobileDriver {
    if (!this.driver) {
      throw new Error("Mobile session is not started");
    }
    return this.driver;
  }

  async start(): Promise<void> {
    let url: URL;
    try {
      url = new URL(this.opts.appiumUrl);
    } catch {
      throw new Error(`appiumUrl is not a valid URL: "${this.opts.appiumUrl}"`);
    }
    const secure = url.protocol === "https:";
    const remoteOptions: MobileRemoteOptions = {
      protocol: secure ? "https" : "http",
      hostname: url.hostname,
      port: url.port ? Number(url.port) : secure ? 443 : 80,
      path: url.pathname || "/",
      capabilities: buildCapabilities(this.opts),
      logLevel: "error",
      connectionRetryCount: 0,
      connectionRetryTimeout: 240_000,
    };

    const factory = this.opts.driverFactory ?? defaultDriverFactory;
    this.driver = await factory(remoteOptions);

    if (this.recordVideo) {
      try {
        await this.driver.startRecordingScreen(RECORDING_OPTIONS);
        this.recording = true;
      } catch (error: any) {
        this.recordingError = String(error?.message ?? error).split("\n")[0];
      }
    }
  }

  /**
   * Finds one element. Waits until at least one element matches; with strict locators (the default)
   * a locator that matches several elements fails unless it has an `index` (D6).
   */
  async find(locator: unknown, stepTimeoutMs?: number): Promise<MobileElement> {
    const resolved = this.resolve(locator);
    const timeout = this.resolveTimeout(stepTimeoutMs);
    return this.findResolved(resolved, timeout);
  }

  /** Like {@link find}, then waits for the element to be displayed within the same overall timeout. */
  async findDisplayed(locator: unknown, stepTimeoutMs?: number): Promise<MobileElement> {
    const resolved = this.resolve(locator);
    const timeout = this.resolveTimeout(stepTimeoutMs);
    const startedAt = Date.now();
    const element = await this.findResolved(resolved, timeout);
    const remaining = Math.max(1, timeout - (Date.now() - startedAt));
    await element.waitForDisplayed({
      timeout: remaining,
      timeoutMsg: `${resolved.label} is not displayed after ${timeout} ms`,
    });
    return element;
  }

  /** Waits until no element matching the locator is displayed. Ignores `index`: any visible match counts. */
  async waitHidden(locator: unknown, stepTimeoutMs?: number): Promise<void> {
    const driver = this.getDriver();
    const resolved = this.resolve(locator);
    const timeout = this.resolveTimeout(stepTimeoutMs);
    await driver.waitUntil(
      async () => {
        const matches = await driver.$$(resolved.selector);
        for (const element of matches) {
          if (await element.isDisplayed()) return false;
        }
        return true;
      },
      { timeout, timeoutMsg: `${resolved.label} is still visible after ${timeout} ms`, interval: ELEMENT_POLL_MS },
    );
  }

  /** Stops the app, optionally wipes its data, then starts it and waits until it is in the foreground. */
  async launch(opts: { clearData?: boolean; timeoutMs?: number } = {}): Promise<void> {
    const driver = this.getDriver();
    const appId = this.opts.appPackage;
    const timeout = this.resolveNavigationTimeout(opts.timeoutMs);

    await driver.execute("mobile: terminateApp", { appId });
    if (opts.clearData) {
      await driver.execute("mobile: clearApp", { appId });
    }
    await driver.execute("mobile: activateApp", { appId });
    await driver.waitUntil(
      async () => (await driver.execute("mobile: queryAppState", { appId })) === APP_STATE_FOREGROUND,
      {
        timeout,
        timeoutMsg: `${appId} did not reach the foreground within ${timeout} ms`,
        interval: ELEMENT_POLL_MS,
      },
    );
  }

  async terminate(): Promise<void> {
    await this.getDriver().execute("mobile: terminateApp", { appId: this.opts.appPackage });
  }

  /** Starts a clean capture window for the next scenario. Best-effort: never throws. */
  async resetCapture(): Promise<void> {
    if (!this.driver || !this.captureConsole) return;
    try {
      // Reading the device log drains it, so the next read only returns newer entries.
      await this.driver.getLogs("logcat");
    } catch {
      // Not every device exposes the log; a failed drain must never fail a scenario.
    }
  }

  /** The device log, and a screenshot when asked for, for a failed scenario. Each part is best-effort. */
  async collectFailureArtifacts(): Promise<FailureArtifact[]> {
    if (!this.driver) return [];
    const artifacts: FailureArtifact[] = [];

    if (this.captureConsole) {
      try {
        const entries = await this.driver.getLogs("logcat");
        const mapped = toConsoleEntries(entries, this.opts.appPackage, MAX_LOGCAT_ENTRIES);
        if (mapped.length) {
          artifacts.push({ name: "console.json", contentType: "application/json", data: JSON.stringify(mapped) });
        }
      } catch {
        // Best-effort.
      }
    }

    if (this.captureScreenshot) {
      try {
        const png = await this.driver.takeScreenshot();
        if (png) {
          artifacts.push({ name: "screenshot.png", contentType: "image/png", data: Buffer.from(png, "base64") });
        }
      } catch {
        // Best-effort.
      }
    }

    return artifacts;
  }

  /** Printable form of a locator for error messages, e.g. `{ by: "accessibilityId", value: "Save" }`. */
  describeLocator(locator: unknown): string {
    return this.resolve(locator).label;
  }

  /** Whole-run recording, available after {@link stop} when it was asked to keep the video. */
  getRunVideo(): FailureArtifact | undefined {
    return this.runVideo;
  }

  /** Never throws: a failure to close must not mask the run's real result. */
  async stop(opts?: { keepVideo?: boolean }): Promise<void> {
    const keepVideo = opts?.keepVideo ?? false;
    const driver = this.driver;
    try {
      if (driver && this.recording) {
        try {
          const base64 = await driver.stopRecordingScreen();
          // Only keep the recording when the run FAILED; passing runs discard it unread.
          if (keepVideo && base64) {
            this.runVideo = { name: "run.mp4", contentType: "video/mp4", data: Buffer.from(base64, "base64") };
          }
        } catch {
          // A recording that cannot be read is simply not attached.
        } finally {
          this.recording = false;
        }
      }
    } finally {
      this.driver = undefined;
      if (driver) {
        try {
          await driver.deleteSession();
        } catch {
          // Best-effort.
        }
      }
    }
  }

  private resolve(locator: unknown): ResolvedLocator {
    return resolveLocator(locator, { appPackage: this.opts.appPackage });
  }

  private async findResolved(resolved: ResolvedLocator, timeout: number): Promise<MobileElement> {
    const driver = this.getDriver();
    await driver.waitUntil(async () => (await driver.$$(resolved.selector)).length > 0, {
      timeout,
      timeoutMsg: `No element matches ${resolved.label} after ${timeout} ms`,
      interval: ELEMENT_POLL_MS,
    });

    const matches = await driver.$$(resolved.selector);
    if (matches.length === 0) {
      throw new Error(`No element matches ${resolved.label} after ${timeout} ms`);
    }
    if (resolved.index !== undefined) {
      if (resolved.index >= matches.length) {
        throw new Error(`Locator ${resolved.label} has no match at index ${resolved.index} (found ${matches.length})`);
      }
      return matches[resolved.index];
    }
    if (this.strictLocators && matches.length > 1) {
      throw new Error(`Locator ${resolved.label} matched ${matches.length} elements; make it unique or add "index"`);
    }
    return matches[0];
  }
}
