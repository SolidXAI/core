export interface RestoreRef {
  setupId: string;
  fresh: boolean;
}

/** Normalises restoreFrom. Returns undefined when absent, or { error } when malformed. */
export function parseRestoreFrom(value: unknown): RestoreRef | { error: string } | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && value.trim().length > 0) return { setupId: value, fresh: false };
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const { setup, fresh } = value as { setup?: unknown; fresh?: unknown };
    if (typeof setup === "string" && setup.trim().length > 0 && (fresh === undefined || typeof fresh === "boolean")) {
      return { setupId: setup, fresh: !!fresh };
    }
  }
  return { error: "restoreFrom must be a setup id or { setup, fresh }" };
}
