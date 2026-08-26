import type { ResourceStore } from "../contracts/runtime-context.types";
import { parsePathSegments } from "./path-segments";

export class SimpleResourceStore implements ResourceStore {
  private readonly data: Record<string, any> = {};

  get(path: string): unknown {
    if (!path) return undefined;
    // Dot and bracket notation both resolve here, so `${res:r.bodyJson.result[0].id}` and
    // `${res:r.bodyJson.result.0.id}` are equivalent — matching `${data:...}`, which has always
    // accepted brackets. `has()` delegates to this, so it follows automatically.
    const parts = parsePathSegments(path);
    let current: any = this.data;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  set(path: string, value: unknown): void {
    if (!path) return;
    // Parsed the same way as `get`, so any path that can be read back can also be written.
    const parts = parsePathSegments(path);
    if (!parts.length) return;
    let current: any = this.data;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (
        current[part] == null ||
        typeof current[part] !== "object" ||
        Array.isArray(current[part])
      ) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }

  has(path: string): boolean {
    return this.get(path) !== undefined;
  }
}
