import type { HealEvent } from "../../contracts/runtime-context.types";
import type { HealingPolicy } from "../../contracts/testing-metadata.types";
import { DEFAULT_UI_TIMEOUT_MS } from "../ui/playwright-adapter";
import type { FailureArtifact } from "../ui/playwright-adapter";
import { buildCapabilities } from "./capabilities";
import { execFile } from "node:child_process";
import { resolveLocator } from "./locator";
import { toConsoleEntries } from "./logcat";
import { appIdArg, BUNDLE_ID_RE, isIos } from "./platform";
import { CLEAR_DATA_ON_PHONE, withPhoneHint } from "./phone-errors";
import { toSyslogConsoleEntries } from "./syslog";
import type { ResolvedLocator } from "./locator";
import type { MobileAdapterOptions, MobileDriver, MobileElement, MobileRemoteOptions, MobileClock } from "./mobile.types";

/** Keep the device log bounded, like the UI adapter's console buffer. */
const MAX_LOGCAT_ENTRIES = 500;

/**
 * Two-thirds scale and a modest bit rate keep a run's recording small (D15). Android records at most 180 s
 * per file, so a longer limit makes Appium record in 180 s chunks. It merges them at the end when `ffmpeg`
 * is installed; without it, Appium returns the most recent chunk, which is the part that matters when a run
 * fails. With a limit of 180 the recording would stop after the first chunk and miss the failure.
 */
const ANDROID_RECORDING_OPTIONS = { videoSize: "720x1600", bitRate: 2_000_000, timeLimit: "1800" };

/**
 * iOS records through ffmpeg, which must be installed. The default codec, mjpeg, does not play in a browser, and the
 * hardware encoder produced an empty file, so libx264 it is. The scale halves the screen, keeping even dimensions (D37).
 */
const IOS_RECORDING_OPTIONS = {
  videoType: "libx264",
  videoFps: 10,
  timeLimit: "1800",
  videoScale: "trunc(iw/4)*2:trunc(ih/4)*2",
};

const SIMCTL_TIMEOUT_MS = 15_000;
const SIMULATOR_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

function defaultRunCommand(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: SIMCTL_TIMEOUT_MS }, (error) => (error ? reject(error) : resolve()));
  });
}

const ELEMENT_POLL_MS = 500;

const realClock: MobileClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** App states from `mobile: queryAppState`, the same numbers on both platforms. 4 means running in the foreground. */
const APP_STATE_FOREGROUND = 4;
const APP_STATE_NOT_RUNNING = 1;
const APP_STATE_NAMES: Record<number, string> = {
  0: "not installed",
  1: "not running",
  2: "background, suspended",
  3: "background",
  4: "foreground",
};
/** How often `launch` starts an app again after Android stopped it while it was starting. */
const MAX_LAUNCH_RESTARTS = 2;

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
 * Drives one Android or iOS device, emulator or simulator through an Appium server. Mirrors PlaywrightAdapter: one
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
  /** The first launch of a session grants permissions on a simulator even without a reset (D28). */
  private launchedOnce = false;
  private readonly logType: "logcat" | "syslog";
  private readonly clock: MobileClock;
  private readonly healing: HealingPolicy;
  /** The driver belongs to the caller (an authoring session): {@link stop} lets go of it but never ends its session. */
  private attached = false;
  private heals: HealEvent[] = [];
  /** The longest a single device lookup took since the last {@link takeSlowestCallMs}, for the step report. */
  private slowestCallMs = 0;

  /** Set when screen recording could not start; the run continues without a video. */
  public recordingError?: string;
  /** Set when a simulator could not be told to allow permissions; the app may then show a permission prompt. */
  public grantError?: string;

  constructor(private readonly opts: MobileAdapterOptions) {
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_UI_TIMEOUT_MS;
    this.navigationTimeoutMs = opts.navigationTimeoutMs ?? this.defaultTimeoutMs;
    this.strictLocators = opts.strictLocators ?? true;
    this.recordVideo = opts.recordVideo ?? true;
    this.captureConsole = opts.capture?.console ?? false;
    this.captureScreenshot = opts.capture?.screenshot ?? false;
    this.logType = isIos(opts) ? "syslog" : "logcat";
    this.clock = opts.clock ?? realClock;
    this.healing = opts.healing ?? "report";
  }

  /** Whether this session drives an iOS device or simulator. */
  get ios(): boolean {
    return isIos(this.opts);
  }

  /** Whether this session drives a real iPhone: iOS, and not a simulator. */
  get phone(): boolean {
    return isIos(this.opts) && !this.opts.simulator;
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

  /**
   * An adapter around a driver the caller already opened and keeps (an authoring session), so steps run through the same
   * code as a test run without this adapter starting, recording or ending the session. `appiumUrl`, `udid` and `appSource`
   * are only used to open a session, so they may be placeholders here.
   */
  static attach(driver: MobileDriver, opts: Omit<MobileAdapterOptions, "appiumUrl" | "udid" | "appSource"> & Partial<MobileAdapterOptions>): MobileAdapter {
    const adapter = new MobileAdapter({
      appiumUrl: "attached",
      udid: "attached",
      appSource: "installed",
      ...opts,
      recordVideo: false,
    });
    adapter.driver = driver;
    adapter.attached = true;
    return adapter;
  }

  /** The screen's accessibility tree as XML. */
  async getPageSource(): Promise<string> {
    return this.getDriver().getPageSource();
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
      // Starting a session waits for the device, and on iOS the first one for WebDriverAgent to build (D34).
      connectionRetryTimeout: this.ios && !this.opts.wdaPrebuilt ? 600_000 : 240_000,
    };

    const factory = this.opts.driverFactory ?? defaultDriverFactory;
    try {
      this.driver = await factory(remoteOptions);
    } catch (error: any) {
      // Only on a phone: these texts mean signing and trust there, and could mean something else on a simulator.
      const explained = this.phone ? withPhoneHint(String(error?.message ?? error)) : undefined;
      if (explained) throw new Error(explained);
      throw error;
    }

    if (this.recordVideo) {
      try {
        await this.driver.startRecordingScreen(this.ios ? IOS_RECORDING_OPTIONS : ANDROID_RECORDING_OPTIONS);
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
    return this.findResolved(resolved, timeout, false);
  }

  /** Like {@link find}, but the element must also be displayed, checked in the same poll within the same timeout. */
  async findDisplayed(locator: unknown, stepTimeoutMs?: number): Promise<MobileElement> {
    const resolved = this.resolve(locator);
    const timeout = this.resolveTimeout(stepTimeoutMs);
    return this.findResolved(resolved, timeout, true);
  }

  /** Waits until no element matching the locator is displayed. Ignores `index`: any visible match counts. */
  async waitHidden(locator: unknown, stepTimeoutMs?: number): Promise<void> {
    const driver = this.getDriver();
    const resolved = this.resolve(locator);
    const timeout = this.resolveTimeout(stepTimeoutMs);
    const deadline = this.clock.now() + timeout;
    for (;;) {
      const matches = await this.withinDeadline(deadline, timeout, `looking for ${resolved.label}`, () => driver.$$(resolved.selector));
      let shown = false;
      for (const element of matches) {
        if (await this.withinDeadline(deadline, timeout, `checking ${resolved.label}`, () => element.isDisplayed())) {
          shown = true;
          break;
        }
      }
      if (!shown) return;
      if (this.clock.now() >= deadline) throw new Error(`${resolved.label} is still visible after ${timeout} ms`);
      await this.clock.sleep(Math.min(ELEMENT_POLL_MS, Math.max(0, deadline - this.clock.now())));
    }
  }

  getHealingPolicy(): HealingPolicy {
    return this.healing;
  }

  recordHeal(heal: HealEvent): void {
    this.heals.push(heal);
  }

  /** Heals recorded since the last {@link resetCapture}. */
  getHeals(): HealEvent[] {
    return [...this.heals];
  }

  /**
   * Whether any element matches the locator within `timeoutMs` (0 asks once). A lookup that does not answer in time
   * counts as "not there", so choosing a healed locator never waits on a stalled device.
   */
  async isPresent(locator: unknown, timeoutMs: number): Promise<boolean> {
    const driver = this.getDriver();
    const resolved = this.resolve(locator);
    const deadline = this.clock.now() + timeoutMs;
    for (;;) {
      try {
        const matches = await this.withinDeadline(deadline, timeoutMs, `looking for ${resolved.label}`, () => driver.$$(resolved.selector));
        if (matches.length > 0) return true;
      } catch {
        return false;
      }
      if (this.clock.now() >= deadline) return false;
      await this.clock.sleep(Math.min(ELEMENT_POLL_MS, Math.max(0, deadline - this.clock.now())));
    }
  }

  /** How many matching elements are displayed right now, without waiting for any to appear. */
  async countDisplayed(locator: unknown, budgetMs = 3000): Promise<number> {
    const driver = this.getDriver();
    const resolved = this.resolve(locator);
    const deadline = this.clock.now() + budgetMs;
    const matches = await this.withinDeadline(deadline, budgetMs, `looking for ${resolved.label}`, () => driver.$$(resolved.selector));
    let shown = 0;
    for (const element of matches) {
      if (await this.withinDeadline(deadline, budgetMs, `checking ${resolved.label}`, () => element.isDisplayed())) shown += 1;
    }
    return shown;
  }

  /** The longest single device lookup since the last call, in ms, and starts counting again. */
  takeSlowestCallMs(): number {
    const slowest = this.slowestCallMs;
    this.slowestCallMs = 0;
    return slowest;
  }

  /**
   * Stops the app, optionally wipes its data, then starts it and waits until it is in the foreground. On iOS a wipe is a
   * reinstall of the build (D27): `clearApp` leaves an app's preferences behind. On a simulator, permissions are granted
   * after the app is installed and before it starts, because the permission prompt cannot be accepted by the session (D28).
   * On Android, permissions are granted again after a wipe, because clearing data revokes them.
   */
  async launch(opts: { clearData?: boolean; timeoutMs?: number; grantPermissions?: boolean } = {}): Promise<void> {
    // A phone's app is installed once, by hand, so there is no build to reinstall from: refuse before touching the app (D41).
    if (opts.clearData && this.phone) throw new Error(CLEAR_DATA_ON_PHONE);
    const driver = this.getDriver();
    const appId = this.opts.appPackage;
    const idArg = appIdArg(this.opts);
    const timeout = this.resolveNavigationTimeout(opts.timeoutMs);

    await driver.execute("mobile: terminateApp", idArg);
    if (opts.clearData) {
      if (this.ios) await this.reinstall();
      else {
        await driver.execute("mobile: clearApp", idArg);
        // Clearing an Android app's data takes back its runtime permissions, so the next permission prompt would
        // cover the screen. Grant them again, unless the scenario is testing that prompt.
        if (opts.grantPermissions !== false) await this.grantAndroidPermissions();
      }
    }
    if (this.opts.simulator && opts.grantPermissions !== false && (opts.clearData || !this.launchedOnce)) {
      await this.grantPermissions();
    }
    this.launchedOnce = true;
    await driver.execute("mobile: activateApp", idArg);

    // Android gives a starting app about ten seconds to attach and kills it otherwise, which is likely on a device that
    // has only just booted or is short of memory. The app then reads "not running", so start it again a few times.
    let lastState: number | undefined;
    let polls = 0;
    let restarts = 0;
    try {
      await driver.waitUntil(
        async () => {
          lastState = Number(await driver.execute("mobile: queryAppState", idArg));
          polls += 1;
          if (lastState === APP_STATE_FOREGROUND) return true;
          if (lastState === APP_STATE_NOT_RUNNING && polls > 1 && restarts < MAX_LAUNCH_RESTARTS) {
            restarts += 1;
            await driver.execute("mobile: activateApp", idArg);
          }
          return false;
        },
        {
          timeout,
          timeoutMsg: `${appId} did not reach the foreground within ${timeout} ms`,
          interval: ELEMENT_POLL_MS,
        },
      );
    } catch (error: any) {
      const detail = [
        lastState !== undefined ? `last state: ${APP_STATE_NAMES[lastState] ?? lastState}` : "",
        restarts ? `started again ${restarts} time${restarts === 1 ? "" : "s"}` : "",
      ].filter(Boolean).join(", ");
      const hint =
        lastState === APP_STATE_NOT_RUNNING
          ? " The app was started but stopped again; the device may be overloaded. See the device log."
          : "";
      throw new Error(`${error?.message ?? error}${detail ? ` (${detail})` : ""}.${hint}`);
    }
  }

  async terminate(): Promise<void> {
    await this.getDriver().execute("mobile: terminateApp", appIdArg(this.opts));
  }

  /** iOS reset: remove the app and install the build again, which clears everything `clearApp` leaves behind (D27). */
  private async reinstall(): Promise<void> {
    const driver = this.getDriver();
    const appPath = this.opts.appPath;
    if (!appPath) {
      throw new Error("Clearing data needs a build to reinstall. Upload the build on the application.");
    }
    try {
      await driver.execute("mobile: removeApp", { bundleId: this.opts.appPackage });
      await driver.execute("mobile: installApp", { app: appPath });
    } catch (error: any) {
      throw new Error(`Could not reinstall ${this.opts.appPackage} to clear its data: ${String(error?.message ?? error).split("\n")[0]}`);
    }
  }

  /**
   * `autoAcceptAlerts` denies permission prompts, so a simulator is told to allow everything before the app starts.
   * Best-effort: a failure leaves the prompt, and the scenario fails where the prompt gets in the way.
   */
  private async grantPermissions(): Promise<void> {
    const { udid, appPackage } = this.opts;
    if (!SIMULATOR_ID_RE.test(udid) || !BUNDLE_ID_RE.test(appPackage)) return;
    try {
      await (this.opts.runCommand ?? defaultRunCommand)("xcrun", ["simctl", "privacy", udid, "grant", "all", appPackage]);
    } catch (error: any) {
      this.grantError = String(error?.message ?? error).split("\n")[0];
    }
  }

  /** Android: grants every runtime permission the app declares. Best-effort: a failure is noted, never thrown. */
  private async grantAndroidPermissions(): Promise<void> {
    try {
      await this.getDriver().execute("mobile: changePermissions", {
        permissions: "all",
        appPackage: this.opts.appPackage,
        action: "grant",
      });
    } catch (error: any) {
      this.grantError = String(error?.message ?? error).split("\n")[0];
    }
  }

  /** Starts a clean capture window for the next scenario. Best-effort: never throws. */
  async resetCapture(): Promise<void> {
    this.heals = [];
    if (!this.driver || !this.captureConsole) return;
    try {
      // Reading the device log drains it, so the next read only returns newer entries.
      await this.driver.getLogs(this.logType);
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
        const entries = await this.driver.getLogs(this.logType);
        const mapped = this.ios
          ? toSyslogConsoleEntries(entries, { processName: this.opts.appProcessName, bundleId: this.opts.appPackage }, MAX_LOGCAT_ENTRIES)
          : toConsoleEntries(entries, this.opts.appPackage, MAX_LOGCAT_ENTRIES);
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

    // The screen's element tree, next to its screenshot: what a repair reads to see what a locator should have matched.
    if (this.captureScreenshot) {
      try {
        const source = await this.driver.getPageSource();
        if (source) artifacts.push({ name: "page-source.xml", contentType: "application/xml", data: source });
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
    if (this.attached) {
      this.driver = undefined;
      return;
    }
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
    return resolveLocator(locator, { appPackage: this.opts.appPackage, platform: this.opts.platformName });
  }

  /**
   * Polls with one lookup per tick (every lookup is a round trip to the device) and returns as soon as the element is
   * there, and displayed when asked, so a step waits only as long as the app needs. The failure messages are the ones
   * the steps and the agent have always matched on.
   */
  private async findResolved(resolved: ResolvedLocator, timeout: number, displayed: boolean): Promise<MobileElement> {
    const driver = this.getDriver();
    const deadline = this.clock.now() + timeout;
    for (;;) {
      const matches = await this.withinDeadline(deadline, timeout, `looking for ${resolved.label}`, () => driver.$$(resolved.selector));
      if (matches.length > 0) {
        const element = this.pickMatch(resolved, matches);
        if (!displayed) return element;
        if (await this.withinDeadline(deadline, timeout, `checking ${resolved.label}`, () => element.isDisplayed())) return element;
      }
      if (this.clock.now() >= deadline) {
        throw new Error(
          matches.length > 0
            ? `${resolved.label} is not displayed after ${timeout} ms`
            : `No element matches ${resolved.label} after ${timeout} ms`,
        );
      }
      await this.clock.sleep(Math.min(ELEMENT_POLL_MS, Math.max(0, deadline - this.clock.now())));
    }
  }

  private pickMatch(resolved: ResolvedLocator, matches: MobileElement[]): MobileElement {
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

  /**
   * Runs one device call that has to answer before `deadline`. UiAutomator2 can leave a request unanswered for tens of
   * seconds while the app's UI is busy. Without a limit that one call outlives the step's timeout, and the step then
   * reports an element as missing that was there. The slowest call is kept for the step report.
   */
  private async withinDeadline<T>(deadline: number, timeout: number, what: string, call: () => Promise<T>): Promise<T> {
    const budget = Math.max(1, deadline - this.clock.now());
    const startedAt = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`The device did not answer while ${what} within the ${timeout} ms timeout; the app's UI may be busy`)),
        budget,
      );
    });
    const pending = call();
    // If the deadline wins, the call may still fail later; nobody is left to hear it.
    pending.catch(() => undefined);
    try {
      return await Promise.race([pending, expired]);
    } finally {
      clearTimeout(timer);
      this.slowestCallMs = Math.max(this.slowestCallMs, Date.now() - startedAt);
    }
  }
}
