// Test helper: an in-memory stand-in for the WebdriverIO driver, so mobile adapter and step tests
// run without Appium or a device. Not used at runtime.
import type { MobileClock, MobileDriver, MobileElement } from "./mobile.types";

export class FakeElement implements MobileElement {
  calls: string[] = [];
  displayed: boolean;
  text: string;
  location: { x: number; y: number };
  size: { width: number; height: number };

  constructor(opts: { displayed?: boolean; text?: string; location?: { x: number; y: number }; size?: { width: number; height: number } } = {}) {
    this.displayed = opts.displayed ?? true;
    this.text = opts.text ?? "";
    this.location = opts.location ?? { x: 100, y: 200 };
    this.size = opts.size ?? { width: 300, height: 400 };
  }

  async click() { this.calls.push("click"); }
  async setValue(value: string) { this.calls.push(`setValue:${value}`); this.text = value; }
  async addValue(value: string) { this.calls.push(`addValue:${value}`); this.text += value; }
  async clearValue() { this.calls.push("clearValue"); this.text = ""; }
  async getText() { this.calls.push("getText"); return this.text; }
  /** How many times the display state was read; a poll should read it once, not once per helper. */
  displayChecks = 0;
  /** Real milliseconds a display check takes, to stand in for a stalled device. */
  isDisplayedDelayMs = 0;
  async isDisplayed() {
    this.displayChecks += 1;
    if (this.isDisplayedDelayMs) await new Promise((resolve) => setTimeout(resolve, this.isDisplayedDelayMs));
    return this.displayed;
  }
  async getLocation() { return this.location; }
  async getSize() { return this.size; }
  async waitForDisplayed(opts?: { timeout?: number; timeoutMsg?: string }) {
    this.calls.push(`waitForDisplayed:${opts?.timeout ?? ""}`);
    if (!this.displayed) throw new Error(opts?.timeoutMsg ?? "element not displayed");
    return true;
  }
}

export class FakeDriver implements MobileDriver {
  /** Elements by WebdriverIO selector string. */
  elements = new Map<string, FakeElement[]>();
  calls: Array<{ method: string; args: unknown[] }> = [];
  logs: Array<{ level?: string; message?: string }> = [];
  screenshotBase64 = Buffer.from("png-bytes").toString("base64");
  recordingBase64 = Buffer.from("mp4-bytes").toString("base64");
  appState = 4;
  /** What `getPageSource` returns. */
  pageSource = "<hierarchy rotation=\"0\"></hierarchy>";
  /** States returned by `mobile: queryAppState`, one per call, before `appState` takes over. */
  appStates: number[] = [];
  keyboardShown = false;
  /** Where the keyboard is while it is shown; without it, a keyboard has no frame to look up. */
  keyboardRect?: { x: number; y: number; width: number; height: number };
  /** Which ways of hiding the keyboard work. Unset: the driver's own call does, as before. */
  hideWith?: Set<"driver" | "tapOutside" | "swipeDown">;
  windowSize = { width: 1080, height: 2400 };
  /** Methods listed here throw when called. */
  failing = new Set<string>();
  /** The message a failing method throws, when it is not the default. */
  failureMessages = new Map<string, string>();
  /** `execute` scripts listed here throw when called, for example "mobile: removeApp". */
  failingScripts = new Set<string>();

  add(selector: string, ...elements: FakeElement[]): FakeElement[] {
    this.elements.set(selector, [...(this.elements.get(selector) ?? []), ...elements]);
    return elements;
  }

  callsTo(method: string) {
    return this.calls.filter((call) => call.method === method);
  }

  private record(method: string, args: unknown[]) {
    this.calls.push({ method, args });
    if (this.failing.has(method)) throw new Error(this.failureMessages.get(method) ?? `${method} failed`);
  }

  async $(selector: string) {
    this.record("$", [selector]);
    return this.elements.get(selector)?.[0] ?? new FakeElement({ displayed: false });
  }
  /** Real milliseconds a lookup takes, from a number or per selector, to stand in for a stalled device. */
  lookupDelayMs: number | ((selector: string) => number) = 0;
  async $$(selector: string) {
    this.record("$$", [selector]);
    const delay = typeof this.lookupDelayMs === "function" ? this.lookupDelayMs(selector) : this.lookupDelayMs;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    if (selector === "-ios class chain:**/XCUIElementTypeKeyboard" && this.keyboardRect && this.keyboardShown) {
      const { x, y, width, height } = this.keyboardRect;
      return [new FakeElement({ location: { x, y }, size: { width, height } })];
    }
    return [...(this.elements.get(selector) ?? [])];
  }
  // No real waiting: poll the condition a few times, then fail with the supplied message.
  async waitUntil(condition: () => Promise<boolean>, opts?: { timeoutMsg?: string }) {
    this.record("waitUntil", [opts]);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await condition()) return true;
    }
    throw new Error(opts?.timeoutMsg ?? "waitUntil timed out");
  }
  async execute(script: string, ...args: unknown[]) {
    this.record("execute", [script, ...args]);
    if (this.failingScripts.has(script)) throw new Error(`${script} failed`);
    if (script === "mobile: tap" && this.hideWith?.has("tapOutside")) this.keyboardShown = false;
    if (script === "mobile: dragFromToForDuration" && this.hideWith?.has("swipeDown")) this.keyboardShown = false;
    return script === "mobile: queryAppState" ? (this.appStates.length ? this.appStates.shift() : this.appState) : undefined;
  }
  async back() { this.record("back", []); }
  async isKeyboardShown() { this.record("isKeyboardShown", []); return this.keyboardShown; }
  async hideKeyboard() { this.record("hideKeyboard", []); if (!this.hideWith || this.hideWith.has("driver")) this.keyboardShown = false; }
  async getWindowSize() { this.record("getWindowSize", []); return this.windowSize; }
  async takeScreenshot() { this.record("takeScreenshot", []); return this.screenshotBase64; }
  async getPageSource() { this.record("getPageSource", []); return this.pageSource; }
  async getLogs(type: string) { this.record("getLogs", [type]); const out = this.logs; this.logs = []; return out; }
  async startRecordingScreen(opts?: Record<string, unknown>) { this.record("startRecordingScreen", [opts]); }
  async stopRecordingScreen() { this.record("stopRecordingScreen", []); return this.recordingBase64; }
  async deleteSession() { this.record("deleteSession", []); }
}

/** A clock that moves only when the adapter sleeps, so polling for a missing element takes no real time. */
export class FakeClock implements MobileClock {
  sleeps: number[] = [];
  private current = 0;
  now() { return this.current; }
  async sleep(ms: number) {
    this.sleeps.push(ms);
    this.current += ms;
  }
}
