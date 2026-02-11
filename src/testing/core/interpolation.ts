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

export function interpolateString(input: string, ctx: TestContext): string {
  return input.replace(TOKEN_REGEX, (_match, token: string) => {
    if (token.startsWith("env:")) {
      const name = token.slice("env:".length);
      if (!name) {
        throw new Error('Invalid interpolation token: "env:"');
      }
      const value = process.env[name];
      if (value === undefined) {
        throw new Error(`Missing env var for token: "${token}"`);
      }
      return value;
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
      return String(value);
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
      return typeof value === "string" ? value : JSON.stringify(value);
    }

    throw new Error(`Unknown interpolation token: "${token}"`);
  });
}

export function interpolateDeep<T>(input: T, ctx: TestContext): T {
  if (typeof input === "string") {
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
