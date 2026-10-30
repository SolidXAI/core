// Arguments of a call-style token, shared by `${random:<generator>(...)}` and `${now:<kind>(...)}`:
// declaring them, parsing them out of the token, and checking what was given.
//
// A value is written bare when it is simple (letters, digits and . - / _ + : @), and quoted when it
// holds anything else: `format='D MMM, YYYY'`. Quote with ' or " (single quotes are easier inside
// JSON); a backslash writes the quote character itself.

export type ArgValue = string | number | boolean;
export type Args = Record<string, ArgValue>;

export interface ArgSpec {
  type: "string" | "number" | "boolean";
  default: ArgValue;
  /** Allowed values of a string argument, compared case-insensitively. */
  values?: readonly string[];
  /** Shape of a free-text string argument, with the wording used when it does not match. */
  pattern?: RegExp;
  patternHint?: string;
  min?: number;
  max?: number;
}

const BARE_VALUE = /^[A-Za-z0-9._\-/+:@]*$/;

export function coerceArg(label: string, key: string, raw: unknown, spec: ArgSpec): ArgValue {
  const where = `${label} "${key}"`;
  if (spec.type === "boolean") {
    if (raw === true || raw === "true") return true;
    if (raw === false || raw === "false") return false;
    throw new Error(`${where} must be true or false (got "${String(raw)}")`);
  }
  if (spec.type === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (String(raw).trim() === "" || !Number.isInteger(n) || n < (spec.min ?? -Infinity) || n > (spec.max ?? Infinity)) {
      throw new Error(`${where} must be a whole number from ${spec.min} to ${spec.max} (got "${String(raw)}")`);
    }
    return n;
  }
  const text = String(raw);
  if (spec.values) {
    const match = spec.values.find((v) => v.toLowerCase() === text.toLowerCase());
    if (match === undefined) {
      throw new Error(`${where} must be one of: ${spec.values.join(", ")} (got "${text}")`);
    }
    return match;
  }
  if (spec.pattern && !spec.pattern.test(text)) {
    throw new Error(`${where} must be ${spec.patternHint} (got "${text}")`);
  }
  return text;
}

/** Checks `raw` against `specs`, filling in defaults. `label` prefixes every message, e.g. `random:panNo`. */
export function resolveArgs(label: string, specs: Record<string, ArgSpec>, raw: Record<string, unknown>): Args {
  for (const key of Object.keys(raw)) {
    if (!specs[key]) {
      throw new Error(`${label} does not take "${key}". It takes: ${Object.keys(specs).join(", ")}`);
    }
  }
  const args: Args = {};
  for (const [key, spec] of Object.entries(specs)) {
    args[key] = raw[key] === undefined ? spec.default : coerceArg(label, key, raw[key], spec);
  }
  return args;
}

// Splits the text between the brackets on commas that are not inside quotes.
function splitArgs(inner: string, whole: string): string[] {
  const parts: string[] = [];
  let quote: string | null = null;
  let last = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (quote) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === ",") {
      parts.push(inner.slice(last, i));
      last = i + 1;
    }
  }
  if (quote) throw new Error(`Unclosed quote in "${whole}"`);
  parts.push(inner.slice(last));
  return parts;
}

// Reads a quoted value; null when anything follows the closing quote.
function unquote(raw: string, whole: string): string | null {
  const quote = raw[0];
  let out = "";
  for (let i = 1; i < raw.length; i += 1) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length) {
      out += raw[i + 1];
      i += 1;
    } else if (c === quote) {
      return i === raw.length - 1 ? out : null;
    } else {
      out += c;
    }
  }
  throw new Error(`Unclosed quote in "${whole}"`);
}

/**
 * Parses what follows `<prefix>:` in a token: `emailAddress` or
 * `emailAddress(domain=acme.test, digits=0)`. `noun` names the first part in messages
 * ("generator", "kind").
 */
export function parseCallToken(
  prefix: string,
  noun: string,
  spec: string,
): { name: string; args: Record<string, string> } {
  const whole = `${prefix}:${spec}`;
  const invalidToken = () =>
    new Error(`Invalid ${prefix} token "${whole}". Write ${prefix}:<${noun}> or ${prefix}:<${noun}>(name=value, ...)`);
  const m = spec.trim().match(/^([A-Za-z][A-Za-z0-9]*)\s*([\s\S]*)$/);
  if (!m) throw invalidToken();
  const name = m[1];
  const rest = m[2].trim();
  const args: Record<string, string> = {};
  if (!rest) return { name, args };
  if (!rest.startsWith("(") || !rest.endsWith(")")) throw invalidToken();

  for (const part of splitArgs(rest.slice(1, -1), whole)) {
    const piece = part.trim();
    if (!piece) continue;
    const eq = piece.indexOf("=");
    const key = eq === -1 ? "" : piece.slice(0, eq).trim();
    if (!key) {
      throw new Error(`Invalid argument "${piece}" in "${whole}". Write name=value`);
    }
    if (key in args) {
      throw new Error(`Argument "${key}" is given twice in "${whole}"`);
    }
    const raw = piece.slice(eq + 1).trim();
    if (raw[0] === "'" || raw[0] === '"') {
      const value = unquote(raw, whole);
      if (value === null) {
        throw new Error(`Invalid argument "${piece}" in "${whole}". Write name=value`);
      }
      args[key] = value;
    } else if (BARE_VALUE.test(raw)) {
      args[key] = raw;
    } else {
      throw new Error(`${prefix}:${name} "${key}" must be quoted: ${key}='${raw}'`);
    }
  }
  return { name, args };
}
