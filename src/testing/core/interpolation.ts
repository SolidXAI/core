import type { TestContext } from "../contracts/runtime-context.types";
import { parsePathSegments } from "./path-segments";

const TOKEN_REGEX = /\$\{([^}]+)\}/g;

function getByPath(obj: Record<string, any>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function getByPathWithBrackets(obj: Record<string, any>, path: string): unknown {
  if (!path) return undefined;
  const parts = parsePathSegments(path);
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

type TokenResolution = { value: unknown; raw: boolean };

const SECRET_PREFIX = "secret:";

/**
 * Collects the secret keys referenced anywhere inside `value` — step args, headers,
 * bodies — without depending on its shape. Used by the runner to resolve exactly the
 * secrets a scenario needs, rather than loading the whole store into a run.
 *
 * Shares TOKEN_REGEX with the resolver deliberately: a second hand-written matcher is
 * how the two drift, and drift means a scenario silently losing a secret it referenced.
 */
export function collectSecretKeys(value: unknown): string[] {
  const keys = new Set<string>();
  for (const match of JSON.stringify(value ?? null).matchAll(TOKEN_REGEX)) {
    const token = match[1];
    if (token.startsWith(SECRET_PREFIX)) {
      const name = token.slice(SECRET_PREFIX.length);
      if (name) keys.add(name);
    }
  }
  return [...keys];
}

function resolveToken(token: string, ctx: TestContext): TokenResolution {
  if (token.startsWith(SECRET_PREFIX)) {
    const name = token.slice(SECRET_PREFIX.length);
    if (!name) {
      throw new Error('Invalid interpolation token: "secret:"');
    }
    // Resolved server-side into ctx.secrets before the run; never caller-supplied.
    const value = ctx.secrets?.[name];
    if (value === undefined) {
      throw new Error(`Missing secret for token: "${token}"`);
    }
    // Secrets carry a declared valueType, so a json/number/boolean secret used as an
    // exact token returns typed rather than stringified. Strings behave like env:.
    return { value, raw: typeof value !== "string" };
  }

  if (token.startsWith("env:")) {
    const name = token.slice("env:".length);
    if (!name) {
      throw new Error('Invalid interpolation token: "env:"');
    }
    const value = ctx.env?.[name] ?? process.env[name];
    if (value === undefined) {
      throw new Error(`Missing env var for token: "${token}"`);
    }
    return { value, raw: false };
  }

  if (token.startsWith("params.")) {
    const path = token.slice("params.".length);
    if (!path) {
      throw new Error('Invalid interpolation token: "params."');
    }
    const value = getByPath(ctx.params, path);
    if (value === undefined) {
      throw new Error(`Missing param for token: "${token}"`);
    }
    return { value, raw: false };
  }

  if (token.startsWith("data:") || token.startsWith("data.")) {
    const prefix = token.startsWith("data:") ? "data:" : "data.";
    let path = token.slice(prefix.length);
    if (!path) {
      throw new Error(`Invalid interpolation token: "${prefix}"`);
    }
    let raw = false;
    if (path.endsWith("._rec")) {
      raw = true;
      path = path.slice(0, -("._rec".length));
    }
    const value = getByPathWithBrackets((ctx as any).testData ?? {}, path);
    if (value === undefined) {
      throw new Error(`Missing test data for token: "${token}"`);
    }
    return { value, raw };
  }

  if (token.startsWith("res:")) {
    const path = token.slice("res:".length);
    if (!path) {
      throw new Error('Invalid interpolation token: "res:"');
    }
    const value = ctx.resources.get(path);
    if (value === undefined) {
      throw new Error(`Missing resource for token: "${token}"`);
    }
    return { value, raw: false };
  }

  throw new Error(`Unknown interpolation token: "${token}"`);
}

// Apply an inline pipe transform to a resolved value.
// Supported: `path | match:REGEX` (returns capture group 1 if present, else the
// whole match) and `path | default:VALUE` (fallback when the match is empty).
function applyTransform(value: unknown, name: string, arg: string | undefined): unknown {
  if (name === "match") {
    if (!arg) throw new Error('Transform "match" requires a regex argument');
    const str = typeof value === "string" ? value : JSON.stringify(value);
    const re = new RegExp(arg);
    const m = str.match(re);
    if (!m) throw new Error(`Transform "match:${arg}" found no match in resolved value`);
    return m[1] !== undefined ? m[1] : m[0];
  }
  if (name === "default") {
    return value === undefined || value === null || value === "" ? arg : value;
  }
  throw new Error(`Unknown interpolation transform: "${name}"`);
}

// Split a token into its base (before the first `|`) and an ordered list of
// transforms. Each transform is `name:arg` (arg may itself contain `:`).
function resolveTokenWithTransforms(token: string, ctx: TestContext): TokenResolution {
  const pipeIdx = token.indexOf("|");
  if (pipeIdx === -1) {
    return resolveToken(token, ctx);
  }
  const base = token.slice(0, pipeIdx).trim();
  const rest = token.slice(pipeIdx + 1);
  const resolved = resolveToken(base, ctx);
  let value = resolved.value;
  for (const rawTransform of rest.split("|")) {
    const t = rawTransform.trim();
    if (!t) continue;
    const colon = t.indexOf(":");
    const name = (colon === -1 ? t : t.slice(0, colon)).trim();
    const arg = colon === -1 ? undefined : t.slice(colon + 1).trim();
    value = applyTransform(value, name, arg);
  }
  return { value, raw: false };
}

export function interpolateString(input: string, ctx: TestContext): string {
  return input.replace(TOKEN_REGEX, (_match, token: string) => {
    const resolved = resolveTokenWithTransforms(token, ctx);
    return typeof resolved.value === "string"
      ? resolved.value
      : JSON.stringify(resolved.value);
  });
}

export function interpolateDeep<T>(input: T, ctx: TestContext): T {
  if (typeof input === "string") {
    const tokenMatch = input.match(/^\$\{([^}]+)\}$/);
    if (tokenMatch) {
      const resolved = resolveTokenWithTransforms(tokenMatch[1], ctx);
      if (resolved.raw) {
        return resolved.value as T;
      }
    }
    return interpolateString(input, ctx) as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => interpolateDeep(item, ctx)) as T;
  }

  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, any>)) {
      out[key] = interpolateDeep(value, ctx);
    }
    return out as T;
  }

  return input;
}
