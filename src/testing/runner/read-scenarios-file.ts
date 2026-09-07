import * as fs from "fs";

import type { ScenarioSpec, TestingDataRecord } from "../contracts/testing-metadata.types";

/**
 * Result of reading a scenario JSON file. `ok:false` means the file was missing,
 * unreadable, or contained invalid JSON — never a thrown error.
 */
export interface ReadScenariosResult {
  scenarios: ScenarioSpec[];
  data?: TestingDataRecord[];
  ok: boolean;
  error?: string;
}

/**
 * Read + parse an application's scenario file `{ testing: { scenarios, data } }` from an
 * absolute path, on the WORKER tier (which shares the filesystem with the caller in the
 * default single-process deployment). Tolerant by design — mirrors
 * ScenarioFileService.resolvePayload in testingHub — so a concurrent editor half-writing
 * the file, a deleted file (TOCTOU between existsSync and readFileSync), or invalid JSON
 * returns `{ ok:false }` instead of throwing. The worker fails the run loudly on `ok:false`.
 *
 * Lives in core (not testingHub) because the worker is a core component and must not import
 * testingHub code.
 */
export function readScenariosFile(absPath: string): ReadScenariosResult {
  if (!absPath || !fs.existsSync(absPath)) {
    return { scenarios: [], ok: false, error: "file_not_found" };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(absPath, "utf-8"));
    const rawScenarios =
      parsed?.testing?.scenarios ??
      parsed?.scenarios ??
      (Array.isArray(parsed) ? parsed : []);
    const scenarios: ScenarioSpec[] = Array.isArray(rawScenarios) ? rawScenarios : [];
    const rawData = parsed?.testing?.data ?? parsed?.data;
    const data: TestingDataRecord[] | undefined = Array.isArray(rawData) ? rawData : undefined;
    return { scenarios, data, ok: true };
  } catch (err) {
    return { scenarios: [], ok: false, error: (err as Error)?.message || "read_error" };
  }
}
