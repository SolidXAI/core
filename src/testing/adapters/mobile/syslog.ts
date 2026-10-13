import type { ConsoleEntry } from "./logcat";

// An iOS system log line, as Appium returns it in `message` (its own `level` is always "ALL"):
//   2026-10-13 21:53:23.018 Df locationd[45761:53f83] [com.apple.locationd.Utility:QA] text
const SYSLOG_LINE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+ (\w+) (\S+?)\[\d+:[0-9a-f]+\] /;

const TYPE_BY_LEVEL: Record<string, ConsoleEntry["type"]> = {
  Db: "debug",
  I: "info",
  Df: "info",
  E: "error",
  Fa: "error",
};

/**
 * Turns raw syslog entries into the console.json shape. The raw log is mostly system chatter (1.3 MB for a short run), so
 * only the app's own lines are kept, plus errors and faults from anywhere that name the app. The newest `max` are
 * returned (D38).
 */
export function toSyslogConsoleEntries(
  entries: Array<{ level?: string; message?: string }>,
  app: { processName?: string; bundleId: string },
  max: number,
): ConsoleEntry[] {
  const kept: ConsoleEntry[] = [];
  for (const entry of entries) {
    const text = String(entry.message ?? "");
    const match = SYSLOG_LINE.exec(text);
    if (!match) continue; // a continuation line has no process to attribute it to
    const [, level, processName] = match;
    const type = TYPE_BY_LEVEL[level] ?? "info";
    const own = !!app.processName && processName === app.processName;
    const important = type === "error" && text.includes(app.bundleId);
    if (own || important) kept.push({ type, text });
  }
  return kept.slice(-max);
}
