export type MobileLocatorBy =
  | "accessibilityId"
  | "id"
  | "text"
  | "textContains"
  | "description"
  | "uiautomator"
  | "xpath";

export interface MobileLocatorCore {
  by: MobileLocatorBy;
  value: string;
  /** Pick the Nth match (0-based) when the locator matches several elements. */
  index?: number;
}

export interface MobileLocator extends MobileLocatorCore {
  /** Used instead of by/value/index when running on Android. */
  android?: MobileLocatorCore;
  /** Reserved for the iOS track; ignored on Android. */
  ios?: MobileLocatorCore;
}

export type MobileAppSource = "upload" | "installed";

/**
 * The part of a WebdriverIO element that the mobile adapter and steps use. Declared here, rather
 * than imported, so core compiles without `webdriverio` installed (it is an optional peer).
 */
export interface MobileElement {
  click(): Promise<void>;
  setValue(value: string): Promise<void>;
  addValue(value: string): Promise<void>;
  clearValue(): Promise<void>;
  getText(): Promise<string>;
  isDisplayed(): Promise<boolean>;
  getLocation(): Promise<{ x: number; y: number }>;
  getSize(): Promise<{ width: number; height: number }>;
  waitForDisplayed(opts?: { timeout?: number; timeoutMsg?: string; reverse?: boolean }): Promise<unknown>;
}

/** The part of the WebdriverIO browser object that the mobile adapter and steps use. */
export interface MobileDriver {
  $(selector: string): Promise<MobileElement>;
  $$(selector: string): Promise<MobileElement[]>;
  waitUntil(
    condition: () => Promise<boolean>,
    opts?: { timeout?: number; timeoutMsg?: string; interval?: number },
  ): Promise<unknown>;
  execute(script: string, ...args: unknown[]): Promise<unknown>;
  back(): Promise<void>;
  isKeyboardShown(): Promise<boolean>;
  hideKeyboard(): Promise<void>;
  getWindowSize(): Promise<{ width: number; height: number }>;
  takeScreenshot(): Promise<string>;
  getLogs(type: string): Promise<Array<{ level?: string; message?: string; timestamp?: number }>>;
  startRecordingScreen(opts?: Record<string, unknown>): Promise<unknown>;
  stopRecordingScreen(): Promise<string>;
  deleteSession(): Promise<void>;
}

/** Options handed to WebdriverIO's `remote()`. */
export interface MobileRemoteOptions {
  protocol: string;
  hostname: string;
  port: number;
  path: string;
  capabilities: Record<string, unknown>;
  logLevel: "error";
  connectionRetryCount: number;
  connectionRetryTimeout: number;
}

export interface MobileAdapterOptions {
  /** Appium server, e.g. http://localhost:4723. */
  appiumUrl: string;
  /** Device serial from `adb devices`. Always required: Appium must never pick a device itself. */
  udid: string;
  platformName?: "Android";
  appSource: MobileAppSource;
  /** Absolute path to the APK on this machine. Required when appSource is "upload". */
  appPath?: string;
  /** Always required. Used for launch, reset, terminate and bare-id locators. */
  appPackage: string;
  /** Launch activity. Required when appSource is "installed". */
  appActivity?: string;
  /** Element waits. Defaults to DEFAULT_UI_TIMEOUT_MS, the same as the UI adapter (D7). */
  defaultTimeoutMs?: number;
  /** App launch and screen changes. Defaults to defaultTimeoutMs, like the UI adapter (D7). */
  navigationTimeoutMs?: number;
  /** A locator that matches several elements fails the step unless it has an index. Default true (D6). */
  strictLocators?: boolean;
  /** Record the whole run. The recording is only kept when the run fails (D15). */
  recordVideo?: boolean;
  /** Capture the device log for failed scenarios (D16). */
  capture?: { console?: boolean };
  /** Extra Appium capabilities, merged last. */
  extraCapabilities?: Record<string, unknown>;
  /** Test hook: replaces the WebdriverIO `remote()` call. */
  driverFactory?: (options: MobileRemoteOptions) => Promise<MobileDriver>;
}
