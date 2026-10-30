import type { ApiAdapter } from "../adapters/api/api-adapter";
import type { MobileAdapter } from "../adapters/mobile/mobile-adapter";
import type { PlaywrightAdapter } from "../adapters/ui/playwright-adapter";
import type { Reporter } from "../reporter/reporter.types";
import type { SpecRegistry } from "../core/spec-registry";
import type { RandomDataRegistry } from "../core/random-data";
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
  mobile?: MobileAdapter;
  last?: { apiResponse?: ApiResponse };
  reporter: Reporter;
  specRegistry?: SpecRegistry;
  testData?: Record<string, Record<string, any>>;
  env?: Record<string, string>;
  /**
   * Secrets referenced by this scenario, resolved server-side before the run.
   * Scoped per scenario — a scenario never sees another scenario's secrets.
   */
  secrets?: Record<string, any>;
  /** Hands out `${random:...}` and `util.random` values; one per run, so values never repeat in it. */
  randomData?: RandomDataRegistry;
  options?: {
    printApiLogs?: boolean;
  };
  /**
   * Location of the step currently executing, as a path into the scenario
   * (`steps[3].when`, `steps[5].then[1]`). Heal reports use it to address the step.
   */
  stepPath?: string;
}

/**
 * A step that passed only because a fallback or fingerprint replaced its selector (UI) or locator (mobile). A mobile heal
 * names which locator it replaced: the base one, or the override for the platform the run was on.
 */
export interface HealEvent {
  scenarioId: string;
  stepPath?: string;
  op: string;
  stepName?: string;
  field: "selector" | "locator" | "locator.android" | "locator.ios";
  /** The selector string (UI), or the `{ by, value, index? }` locator (mobile) that missed. */
  from: string | Record<string, unknown>;
  to: string | Record<string, unknown>;
  strategy: "fallback" | "fingerprint";
  policy: "report" | "auto";
}
