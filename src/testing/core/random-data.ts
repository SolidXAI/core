// Random test data: the `${random:<generator>(args)}` token and the `util.random` step. Dates are
// built in dates.ts; arguments are declared and parsed in call-args.ts.
//
// Generated values must look like real input (a form or an API validates them) and must not
// repeat within a run, because a run often creates several records whose fields are unique in the
// application under test. Each run gets one RandomDataRegistry, which remembers what it has handed
// out per generator.

import { randomInt } from "crypto";
import type { TestContext } from "../contracts/runtime-context.types";
import { parseCallToken, resolveArgs, type ArgSpec, type Args } from "./call-args";
import { checkFormat, dayAt, daysIn, formatDate, parseWindow, rangeOf, TIME_ARG } from "./dates";
import { FIRST_NAMES, LAST_NAMES, type NameLocale } from "./random-names";


interface Generator {
  args: Record<string, ArgSpec>;
  /**
   * A value in its canonical form: the form compared for uniqueness. A phone number is canonical
   * in E.164, so the same number written in two formats still counts as a repeat.
   */
  next?: (args: Args) => string;
  /** Checks combinations of arguments that are each valid alone; throws a message that says what to change. */
  validate?: (args: Args) => void;
  /** Every canonical value, for a generator whose values come from a small, fixed set. */
  pool?: (args: Args) => readonly string[] | undefined;
  /** Turns a canonical value into the requested output format. Defaults to the value itself. */
  render?: (canonical: string, args: Args) => string;
}

// Each non-pool generator gets this many tries at a value not used yet before the run is told
// it has run out; its value space is millions wide, so reaching it means a real exhaustion.
const MAX_TRIES = 200;

// A date range with more days than this is drawn by retrying, not from a list of its days.
const MAX_DATE_POOL_DAYS = 20_000;

const UNIQUE_ARG: ArgSpec = { type: "boolean", default: true };

const PHONE_FORMATS = ["digits", "national", "e164", "international"] as const;
const LOCALES = ["any", "in", "gb", "us"] as const;
const COUNTRIES = ["in", "gb", "us"] as const;
const DIGITS = "0123456789";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";

function dateFormat(a: Args): string {
  return String(a.format) || (String(a.time).toLowerCase() === "none" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}

function chars(alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(alphabet.length)];
  return out;
}

function namesFor(table: Record<NameLocale, readonly string[]>, locale: string): readonly string[] {
  if (locale !== "any") return table[locale as NameLocale];
  return [...new Set([...table.in, ...table.gb, ...table.us])];
}

// The letters of a name as they would appear in an email address: "D'Souza" becomes "dsouza".
function emailPart(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

// Area codes in use across the US, so a generated number has a real-looking prefix.
const US_AREA_CODES = [
  "201", "202", "206", "212", "213", "214", "216", "248", "303", "305", "312", "314", "404", "412",
  "415", "469", "503", "512", "602", "615", "617", "619", "646", "702", "704", "713", "718", "720",
  "773", "786", "801", "818", "832", "858", "917", "919", "925", "949", "954", "972",
];

// UK mobile numbers are 07 followed by 9 digits. 070 (personal numbers) and 076 (pagers) are not
// mobiles, so the third digit comes from the mobile ranges only.
const UK_MOBILE_THIRD_DIGITS = ["1", "2", "3", "4", "5", "7", "8", "9"];

const GENERATORS: Record<string, Generator> = {
  firstName: {
    args: { locale: { type: "string", default: "any", values: LOCALES } },
    pool: (a) => namesFor(FIRST_NAMES, String(a.locale)),
  },
  lastName: {
    args: { locale: { type: "string", default: "any", values: LOCALES } },
    pool: (a) => namesFor(LAST_NAMES, String(a.locale)),
  },
  emailAddress: {
    args: {
      // example.com is reserved for documentation (RFC 2606): mail to it is never delivered.
      domain: {
        type: "string",
        default: "example.com",
        pattern: /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i,
        patternHint: "a domain such as example.com",
      },
      format: { type: "string", default: "first.last", values: ["first.last", "firstlast", "first_last", "flast", "random"] },
      // Digits after the name part. They keep addresses distinct across runs as well, where an
      // application's unique-email rule would otherwise reject a name seen in an earlier run.
      digits: { type: "number", default: 4, min: 0, max: 8 },
      // Length of the local part for format=random.
      length: { type: "number", default: 10, min: 4, max: 64 },
    },
    next: (a) => {
      const first = emailPart(pick(namesFor(FIRST_NAMES, "any")));
      const last = emailPart(pick(namesFor(LAST_NAMES, "any")));
      let local: string;
      switch (a.format) {
        case "firstlast": local = `${first}${last}`; break;
        case "first_last": local = `${first}_${last}`; break;
        case "flast": local = `${first[0]}${last}`; break;
        case "random": local = chars(LOWER_ALNUM, Number(a.length)); break;
        default: local = `${first}.${last}`;
      }
      if (a.format !== "random") local += chars(DIGITS, Number(a.digits));
      return `${local}@${String(a.domain).toLowerCase()}`;
    },
  },
  mobileNo: {
    args: {
      country: { type: "string", default: "in", values: COUNTRIES },
      format: { type: "string", default: "digits", values: PHONE_FORMATS },
      // Numbers set aside for fiction, so nothing is sent to a real person: the UK's Ofcom drama
      // range (07700 900000 to 900999, 1,000 numbers) and the US's 555-0100 to 555-0199 in every
      // area code (100 per area code). India has no such range.
      fictional: { type: "boolean", default: false },
    },
    validate: (a) => {
      if (a.fictional && a.country === "in") {
        throw new Error(
          'random:mobileNo "fictional" works only for country gb or us; India has no range reserved for fiction',
        );
      }
    },
    next: (a) => {
      switch (a.country) {
        // Indian mobile numbers are 10 digits starting with 6, 7, 8 or 9.
        case "in": return `+91${pick(["6", "7", "8", "9"])}${chars(DIGITS, 9)}`;
        case "gb": return `+447${pick(UK_MOBILE_THIRD_DIGITS)}${chars(DIGITS, 8)}`;
        default: {
          // The exchange's first digit is 2-9, and N11 (service codes) and 555 are left out.
          let exchange: string;
          do {
            exchange = `${randomInt(2, 10)}${chars(DIGITS, 2)}`;
          } while (exchange.endsWith("11") || exchange === "555");
          return `+1${pick(US_AREA_CODES)}${exchange}${chars(DIGITS, 4)}`;
        }
      }
    },
    pool: (a) => {
      if (!a.fictional) return undefined;
      if (a.country === "gb") {
        return Array.from({ length: 1000 }, (_, i) => `+447700900${String(i).padStart(3, "0")}`);
      }
      return US_AREA_CODES.flatMap((area) =>
        Array.from({ length: 100 }, (_, i) => `+1${area}55501${String(i).padStart(2, "0")}`),
      );
    },
    render: (e164, a) => {
      const format = a.format;
      if (format === "e164") return e164;
      if (a.country === "in") {
        const n = e164.slice(3);
        if (format === "national") return `${n.slice(0, 5)} ${n.slice(5)}`;
        if (format === "international") return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
        return n;
      }
      if (a.country === "gb") {
        const n = `0${e164.slice(3)}`;
        if (format === "national") return `${n.slice(0, 5)} ${n.slice(5)}`;
        if (format === "international") return `+44 ${n.slice(1, 5)} ${n.slice(5)}`;
        return n;
      }
      const n = e164.slice(2);
      if (format === "national") return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
      if (format === "international") return `+1 ${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
      return n;
    },
  },
  panNo: {
    args: {
      // The PAN's 4th letter says who holds it: P person, C company, H Hindu undivided family,
      // F firm, A association of persons, T trust, B body of individuals, L local authority,
      // J artificial juridical person, G government.
      holderType: { type: "string", default: "P", values: ["P", "C", "H", "F", "A", "T", "B", "L", "J", "G"] },
    },
    // AAAPA1234A: 3 letters, the holder type, a letter, 4 digits (never 0000), a check letter.
    // The check letter's rule is not published, so it is random; validators check the shape only.
    next: (a) => `${chars(UPPER, 3)}${a.holderType}${chars(UPPER, 1)}${String(randomInt(1, 10000)).padStart(4, "0")}${chars(UPPER, 1)}`,
  },
  date: {
    args: {
      // Where the range starts and ends: today, now, 2026-10-17, or a shift such as -18y or +30d.
      from: { type: "string", default: "-1y" },
      to: { type: "string", default: "+1y" },
      // none: midnight; random: any time of day; HH:mm-HH:mm: a time inside that window.
      time: { type: "string", default: "none", pattern: TIME_ARG, patternHint: "none, random or a window such as 09:00-18:00" },
      // A dayjs format, iso or epoch. Empty means YYYY-MM-DD, or with a time YYYY-MM-DD HH:mm.
      format: { type: "string", default: "" },
      tz: { type: "string", default: "local" },
      // A year has only 365 days, so repeats are allowed unless asked otherwise.
      unique: { type: "boolean", default: false },
    },
    validate: (a) => {
      rangeOf("random:date", String(a.from), String(a.to), String(a.tz));
      if (String(a.format)) checkFormat("random:date", String(a.format));
      if (!["none", "random"].includes(String(a.time).toLowerCase())) parseWindow("random:date", String(a.time));
    },
    // Every distinct day of a short range, so `unique` runs out exactly when the days do.
    pool: (a) => {
      if (!a.unique || String(a.time).toLowerCase() !== "none") return undefined;
      const range = rangeOf("random:date", String(a.from), String(a.to), String(a.tz));
      const days = daysIn(range);
      if (days > MAX_DATE_POOL_DAYS) return undefined;
      const format = dateFormat(a);
      return [...new Set(Array.from({ length: days }, (_, i) => formatDate(dayAt(range, i), format)))];
    },
    next: (a) => {
      const range = rangeOf("random:date", String(a.from), String(a.to), String(a.tz));
      const format = dateFormat(a);
      const time = String(a.time).toLowerCase();
      if (time === "random") {
        const seconds = Math.floor((range.end.valueOf() - range.start.valueOf()) / 1000);
        return formatDate(range.start.add(randomInt(seconds + 1), "second"), format);
      }
      const day = dayAt(range, randomInt(daysIn(range)));
      if (time === "none") return formatDate(day, format);
      const [from, to] = parseWindow("random:date", time);
      const minute = randomInt(from, to + 1);
      return formatDate(day.hour(Math.floor(minute / 60)).minute(minute % 60), format);
    },
  },
  invoiceId: {
    args: {
      prefix: { type: "string", default: "INV", pattern: /^[A-Za-z0-9]{0,10}$/, patternHint: "up to 10 letters or digits" },
      separator: { type: "string", default: "-", values: ["-", "/", "_", "none"] },
      // Number of digits in the running number.
      length: { type: "number", default: 8, min: 4, max: 20 },
      date: { type: "string", default: "none", values: ["none", "yyyy", "yyyymm", "yyyymmdd", "yyyymmddhhmm", "yyyymmddhhmmss"] },
    },
    next: (a) => {
      // The runner machine's local time, when the value is generated; `date` keeps the leading part.
      const now = new Date();
      const two = (n: number) => String(n).padStart(2, "0");
      const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
      const date = a.date === "none" ? "" : stamp.slice(0, String(a.date).length);
      const sep = a.separator === "none" ? "" : String(a.separator);
      return [a.prefix, date, chars(DIGITS, Number(a.length))].filter(Boolean).join(sep);
    },
  },
};

// A generator's own arguments, then `unique` (true unless the generator declares its own default).
function argSpecsOf(generator: Generator): Record<string, ArgSpec> {
  return "unique" in generator.args ? generator.args : { ...generator.args, unique: UNIQUE_ARG };
}

export const RANDOM_GENERATOR_NAMES = Object.keys(GENERATORS);

/**
 * Parses what follows `random:` in a token: `emailAddress` or
 * `emailAddress(domain=acme.test, digits=0)`. See call-args.ts for how values are written.
 */
export function parseRandomToken(spec: string): { name: string; args: Record<string, string> } {
  return parseCallToken("random", "generator", spec);
}

/** Hands out random values for one run, never the same value twice per generator unless asked. */
export class RandomDataRegistry {
  private readonly used = new Map<string, Set<string>>();

  generate(name: string, rawArgs: Record<string, unknown> = {}): string {
    const generator = GENERATORS[name];
    if (!generator) {
      throw new Error(`Unknown random generator "${name}". Use one of: ${RANDOM_GENERATOR_NAMES.join(", ")}`);
    }
    const args = resolveArgs(`random:${name}`, argSpecsOf(generator), rawArgs);
    generator.validate?.(args);
    const used = this.used.get(name) ?? new Set<string>();
    this.used.set(name, used);
    const render = (canonical: string) => (generator.render ? generator.render(canonical, args) : canonical);

    const pool = generator.pool?.(args);
    if (pool) {
      const free = args.unique ? pool.filter((v) => !used.has(v)) : pool;
      if (!free.length) {
        throw new Error(
          `random:${name} has used all ${pool.length} of its values in this run. ` +
            `Pass unique=false to allow repeats.`,
        );
      }
      const value = pick(free);
      used.add(value);
      return render(value);
    }

    for (let i = 0; i < MAX_TRIES; i += 1) {
      const value = generator.next!(args);
      if (!args.unique || !used.has(value)) {
        used.add(value);
        return render(value);
      }
    }
    throw new Error(
      `random:${name} found no value unused in this run after ${MAX_TRIES} tries (${used.size} used). ` +
        `Pass unique=false to allow repeats.`,
    );
  }
}

// A context built without a registry (a caller of the engine that predates it) still gets one per
// run: the resource store is created once per run, so it keys the run.
const fallbackRegistries = new WeakMap<object, RandomDataRegistry>();

export function randomDataFor(ctx: TestContext): RandomDataRegistry {
  if (ctx.randomData) return ctx.randomData;
  let registry = fallbackRegistries.get(ctx.resources);
  if (!registry) {
    registry = new RandomDataRegistry();
    fallbackRegistries.set(ctx.resources, registry);
  }
  return registry;
}
