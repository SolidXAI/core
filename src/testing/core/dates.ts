// Dates for `${random:date(...)}` and `${now:<kind>(...)}`. Built on dayjs, which core already
// depends on, so `format` takes the usual dayjs/moment patterns (YYYY-MM-DD, DD/MM/YYYY, ...).
//
// Only the utc and timezone plugins are loaded: dayjs plugins are global, and loading others
// would change formatting elsewhere in core.

import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { resolveArgs, type ArgSpec, type Args } from "./call-args";

dayjs.extend(utc);
dayjs.extend(timezone);

// ---- time zones -----------------------------------------------------------------------------

export interface Zone {
  now(): Dayjs;
  /** A date or date-time written in this zone. */
  parse(text: string): Dayjs;
}

/** `local` (the machine running the test), `utc`, or an IANA zone such as Asia/Kolkata. */
export function resolveZone(label: string, tz: string): Zone {
  const name = tz.trim();
  if (name.toLowerCase() === "local") return { now: () => dayjs(), parse: (s) => dayjs(s) };
  if (name.toLowerCase() === "utc") return { now: () => dayjs.utc(), parse: (s) => dayjs.utc(s) };
  try {
    dayjs().tz(name);
  } catch {
    throw new Error(`${label} "tz" must be local, utc or an IANA time zone such as Asia/Kolkata (got "${tz}")`);
  }
  return { now: () => dayjs().tz(name), parse: (s) => dayjs.tz(s, name) };
}

// ---- points in time -------------------------------------------------------------------------

const UNITS = { y: "year", m: "month", w: "week", d: "day", h: "hour", min: "minute", s: "second" } as const;
const TERM = /([+-])(\d+)(min|y|m|w|d|h|s)/g;
const TERMS_ONLY = /^(?:[+-]\d+(?:min|y|m|w|d|h|s))+$/;
const POINT = /^(today|now|\d{4}-\d{2}-\d{2})?((?:[+-]\d+(?:min|y|m|w|d|h|s))*)$/;

function applyTerms(d: Dayjs, terms: string): Dayjs {
  let out = d;
  for (const m of terms.matchAll(TERM)) {
    out = out.add((m[1] === "-" ? -1 : 1) * Number(m[2]), UNITS[m[3] as keyof typeof UNITS]);
  }
  return out;
}

/**
 * A shift from the current moment: `0`, or terms such as `+7d`, `-1m`, `+1d+2h`
 * (y years, m months, w weeks, d days, h hours, min minutes, s seconds).
 */
export function applyOffset(label: string, offset: string, from: Dayjs): Dayjs {
  const text = offset.trim();
  if (text === "0" || text === "") return from;
  if (!TERMS_ONLY.test(text)) {
    throw new Error(`${label} "offset" must be 0 or terms such as +7d, -1m or +1d+2h (got "${offset}")`);
  }
  return applyTerms(from, text);
}

export interface Point {
  at: Dayjs;
  /** True when the point names a moment (now, or hours/minutes/seconds); false for a whole day. */
  exact: boolean;
}

/**
 * A point in time: `today`, `now` or `YYYY-MM-DD`, followed by terms (`-18y`, `+30d`, `+1d+2h`).
 * With no base it is today. A point without now, hours, minutes or seconds means the whole day.
 */
export function resolvePoint(label: string, key: string, text: string, zone: Zone): Point {
  const m = POINT.exec(text.trim());
  if (!m || (!m[1] && !m[2])) {
    throw new Error(
      `${label} "${key}" must be a date such as today, now, 2026-10-17, -18y or +1d+2h (got "${text}")`,
    );
  }
  let base: Dayjs;
  if (m[1] === "now") {
    base = zone.now();
  } else if (!m[1] || m[1] === "today") {
    base = zone.now().startOf("day");
  } else {
    base = zone.parse(m[1]);
    // dayjs rolls 2026-13-45 over to a later date instead of rejecting it.
    if (!base.isValid() || base.format("YYYY-MM-DD") !== m[1]) {
      throw new Error(`${label} "${key}" is not a real date (got "${text}")`);
    }
  }
  return { at: applyTerms(base, m[2]), exact: m[1] === "now" || /\d(?:min|h|s)/.test(m[2]) };
}

// ---- formats --------------------------------------------------------------------------------

/**
 * Patterns written for Java, C# or Python (`dd/mm/yyyy`) are accepted by dayjs without a word and
 * give nonsense (`Sa/59/yyyy`), so the usual slips are refused with the token to use.
 */
export function checkFormat(label: string, format: string): void {
  if (format === "iso" || format === "epoch") return;
  const text = format.replace(/\[[^\]]*\]/g, ""); // [literal text] is ignored by dayjs
  const year = /y+/.exec(text);
  if (year) {
    throw new Error(`${label} "format" uses "${year[0]}", which dayjs does not know. Use YYYY for the year (YY for two digits)`);
  }
  if (/(?<!d)dd(?!d)/.test(text)) {
    throw new Error(`${label} "format" uses "dd", which dayjs reads as the short weekday (Sa). Use DD for the day of the month`);
  }
  if (/mm/.test(text) && !/[Hh]/.test(text)) {
    throw new Error(`${label} "format" uses "mm" with no hour, which dayjs reads as minutes. Use MM for the month`);
  }
}

export function formatDate(d: Dayjs, format: string): string {
  if (format === "iso") return d.format();
  if (format === "epoch") return String(d.valueOf());
  return d.format(format);
}

// ---- ${now:...} -----------------------------------------------------------------------------

const NOW_FORMATS: Record<string, string> = {
  date: "YYYY-MM-DD",
  time: "HH:mm:ss",
  datetime: "YYYY-MM-DD HH:mm:ss",
  iso: "iso",
  epoch: "epoch",
};

export const NOW_KINDS = Object.keys(NOW_FORMATS);

const NOW_ARGS: Record<string, ArgSpec> = {
  offset: { type: "string", default: "0" },
  format: { type: "string", default: "" },
  tz: { type: "string", default: "local" },
};

/** The current date or time, shifted by `offset`, as text. */
export function resolveNow(kind: string, rawArgs: Record<string, unknown> = {}): string {
  if (!NOW_KINDS.includes(kind)) {
    throw new Error(`Unknown now kind "${kind}". Use one of: ${NOW_KINDS.join(", ")}`);
  }
  const label = `now:${kind}`;
  const args: Args = resolveArgs(label, NOW_ARGS, rawArgs);
  const zone = resolveZone(label, String(args.tz));
  const format = String(args.format) || NOW_FORMATS[kind];
  checkFormat(label, format);
  return formatDate(applyOffset(label, String(args.offset), zone.now()), format);
}

// ---- ranges for random:date -----------------------------------------------------------------

export interface DateRange {
  zone: Zone;
  /** First instant of the range. */
  start: Dayjs;
  /** Last instant of the range. */
  end: Dayjs;
}

export function rangeOf(label: string, from: string, to: string, tz: string): DateRange {
  const zone = resolveZone(label, tz);
  const a = resolvePoint(label, "from", from, zone);
  const b = resolvePoint(label, "to", to, zone);
  const start = a.exact ? a.at : a.at.startOf("day");
  const end = b.exact ? b.at : b.at.endOf("day");
  if (start.isAfter(end)) {
    throw new Error(`${label} "from" (${from}) is after "to" (${to})`);
  }
  return { zone, start, end };
}

/** How many calendar days the range touches. */
export function daysIn(range: DateRange): number {
  const first = range.start.startOf("day").valueOf();
  const last = range.end.startOf("day").valueOf();
  return Math.round((last - first) / 86_400_000) + 1;
}

export function dayAt(range: DateRange, index: number): Dayjs {
  return range.start.startOf("day").add(index, "day");
}

export const TIME_ARG = /^(none|random|(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d)$/i;

/** The minutes after midnight of a `HH:mm-HH:mm` window. */
export function parseWindow(label: string, time: string): [number, number] {
  const [from, to] = time.split("-").map((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  });
  if (from > to) {
    throw new Error(`${label} "time" window ${time} ends before it starts`);
  }
  return [from, to];
}
