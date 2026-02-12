import type { ApiAdapter } from "../adapters/api/api-adapter";
import type { PlaywrightAdapter } from "../adapters/ui/playwright-adapter";
import type { Reporter } from "../reporter/reporter.types";
import type { SpecRegistry } from "../core/spec-registry";
import type { ScenarioType } from "./testing-metadata.types";

export type StepPhase = "given" | "when" | "then" | "and" | "step";

export interface ResourceStore {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  has(path: string): boolean;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson?: unknown;
}

export interface TestContext {
  scenarioId: string;
  scenarioType: ScenarioType;
  params: Record<string, any>;
  resources: ResourceStore;
  api?: ApiAdapter;
  ui?: PlaywrightAdapter;
  last?: { apiResponse?: ApiResponse };
  reporter: Reporter;
  specRegistry?: SpecRegistry;
  testData?: Record<string, Record<string, any>>;
  options?: {
    printApiLogs?: boolean;
  };
}
