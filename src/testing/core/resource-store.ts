import type { ResourceStore } from "../contracts/runtime-context.types";

export class SimpleResourceStore implements ResourceStore {
  private readonly data: Record<string, any> = {};

  get(path: string): unknown {
    if (!path) return undefined;
    const parts = path.split(".");
    let current: any = this.data;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  set(path: string, value: unknown): void {
    if (!path) return;
    const parts = path.split(".");
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
