// Test helper: an in-memory stand-in for the WebdriverIO driver, so mobile adapter and step tests
// run without Appium or a device. Not used at runtime.
import type { MobileDriver, MobileElement } from "./mobile.types";

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
  async isDisplayed() { return this.displayed; }
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
  /** States returned by `mobile: queryAppState`, one per call, before `appState` takes over. */
  appStates: number[] = [];
  keyboardShown = false;
  windowSize = { width: 1080, height: 2400 };
  /** Methods listed here throw when called. */
  failing = new Set<string>();

  add(selector: string, ...elements: FakeElement[]): FakeElement[] {
    this.elements.set(selector, [...(this.elements.get(selector) ?? []), ...elements]);
    return elements;
  }

  callsTo(method: string) {
    return this.calls.filter((call) => call.method === method);
  }

  private record(method: string, args: unknown[]) {
    this.calls.push({ method, args });
    if (this.failing.has(method)) throw new Error(`${method} failed`);
  }

  async $(selector: string) {
    this.record("$", [selector]);
    return this.elements.get(selector)?.[0] ?? new FakeElement({ displayed: false });
  }
  async $$(selector: string) {
    this.record("$$", [selector]);
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
    return script === "mobile: queryAppState" ? (this.appStates.length ? this.appStates.shift() : this.appState) : undefined;
  }
  async back() { this.record("back", []); }
  async isKeyboardShown() { this.record("isKeyboardShown", []); return this.keyboardShown; }
  async hideKeyboard() { this.record("hideKeyboard", []); this.keyboardShown = false; }
  async getWindowSize() { this.record("getWindowSize", []); return this.windowSize; }
  async takeScreenshot() { this.record("takeScreenshot", []); return this.screenshotBase64; }
  async getLogs(type: string) { this.record("getLogs", [type]); const out = this.logs; this.logs = []; return out; }
  async startRecordingScreen(opts?: Record<string, unknown>) { this.record("startRecordingScreen", [opts]); }
  async stopRecordingScreen() { this.record("stopRecordingScreen", []); return this.recordingBase64; }
  async deleteSession() { this.record("deleteSession", []); }
}
