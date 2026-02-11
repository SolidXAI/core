import type { TestContext } from "../contracts/runtime-context.types";

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

function parsePathSegments(path: string): string[] {
  const segments: string[] = [];
  let buffer = "";
  let i = 0;

  const pushBuffer = () => {
    if (buffer) {
      segments.push(buffer);
      buffer = "";
    }
  };

  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      pushBuffer();
      i += 1;
      continue;
    }
    if (ch === "[") {
      pushBuffer();
      i += 1;
      if (i >= path.length) break;
      let quote = "";
      if (path[i] === '"' || path[i] === "'") {
        quote = path[i];
        i += 1;
      }
      let value = "";
      while (i < path.length) {
        const c = path[i];
        if (quote) {
          if (c === "\\" && i + 1 < path.length) {
            value += path[i + 1];
            i += 2;
            continue;
          }
          if (c === quote) {
            i += 1;
            break;
          }
          value += c;
          i += 1;
          continue;
        }
        if (c === "]") break;
        value += c;
        i += 1;
      }
      while (i < path.length && path[i] !== "]") {
        i += 1;
      }
      if (i < path.length && path[i] === "]") {
        i += 1;
      }
      if (value) {
        segments.push(value);
      }
      continue;
    }
    buffer += ch;
    i += 1;
  }

  pushBuffer();
  return segments;
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

function resolveToken(token: string, ctx: TestContext): TokenResolution {
  if (token.startsWith("env:")) {
    const name = token.slice("env:".length);
    if (!name) {
      throw new Error('Invalid interpolation token: "env:"');
    }
    const value = process.env[name];
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

export function interpolateString(input: string, ctx: TestContext): string {
  return input.replace(TOKEN_REGEX, (_match, token: string) => {
    const resolved = resolveToken(token, ctx);
    return typeof resolved.value === "string"
      ? resolved.value
      : JSON.stringify(resolved.value);
  });
}

export function interpolateDeep<T>(input: T, ctx: TestContext): T {
  if (typeof input === "string") {
    const tokenMatch = input.match(/^\$\{([^}]+)\}$/);
    if (tokenMatch) {
      const resolved = resolveToken(tokenMatch[1], ctx);
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
