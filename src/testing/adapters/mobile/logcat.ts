export interface ConsoleEntry {
  type: "debug" | "info" | "warning" | "error";
  text: string;
}

// Appium's logcat entries all carry level "ALL"; the real Android priority is inside the line:
//   10-09 09:49:37.434   363  3815 I resolv  : message
const THREADTIME_LINE = /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\d+\s+\d+\s+([VDIWEFA])\s/;

const TYPE_BY_PRIORITY: Record<string, ConsoleEntry["type"]> = {
  V: "debug",
  D: "debug",
  I: "info",
  W: "warning",
  E: "error",
  F: "error",
  A: "error",
};

// Tags worth keeping at any priority: React Native's JS console, crashes, and WebView console output.
const ALWAYS_KEEP = /\b(ReactNativeJS|AndroidRuntime|chromium)\b/;

/**
 * Turns raw logcat entries into the console.json shape the web adapter uses. A device log is mostly system
 * chatter (the first read returns the whole 10,000-line buffer), so only useful lines are kept: warnings and
 * errors from anything, plus the app's own lines and the tags above. The newest `max` are returned.
 */
export function toConsoleEntries(
  entries: Array<{ level?: string; message?: string }>,
  appPackage: string,
  max: number,
): ConsoleEntry[] {
  const kept: ConsoleEntry[] = [];
  for (const entry of entries) {
    const text = String(entry.message ?? "");
    const match = THREADTIME_LINE.exec(text);
    const type = match ? TYPE_BY_PRIORITY[match[1]] : (String(entry.level ?? "info").toLowerCase() as ConsoleEntry["type"]);
    const important = type === "warning" || type === "error";
    if (important || (appPackage && text.includes(appPackage)) || ALWAYS_KEEP.test(text)) {
      kept.push({ type, text });
    }
  }
  return kept.slice(-max);
}
