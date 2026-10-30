export type ScenarioType = "api" | "ui" | "mixed" | "mobile";

export interface TestingDataRecord {
  modelUserKey: string;
  recUserKeyValue: string;
  data: Record<string, any>;
}

export interface TestingRoleSpec {
  name: string;
  permissions?: string[];
}

export interface TestingUserSpec {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  mobile?: string;
  roles?: string[];
  /**
   * Seed this user through the registered IExtensionUserCreationProvider, making it
   * an instance of the app's extension entity rather than a base `User`.
   *
   * Absent means a base `User`, so existing specs are unaffected. Set it on users
   * that carry extension fields (`userType` and the like) - without it those fields
   * are ignored and a plain `User` is created.
   *
   * `roles` is ignored on a flagged user: the provider derives them from the
   * extension fields, exactly as it does on the model's own CRUD form.
   */
  isExtensionUser?: boolean;
  [key: string]: any;
}

export interface TestingMetadata {
  testing: {
    specs?: string[];
    roles?: TestingRoleSpec[];
    users?: TestingUserSpec[];
    data?: TestingDataRecord[];
    scenarios: ScenarioSpec[];
  };
}

export interface ScenarioSpec {
  id: string;
  name?: string;
  type: ScenarioType;
  params?: Record<string, any>;
  tags?: string[];
  timeoutMs?: number;
  retries?: number;
  /**
   * Scenarios that must pass before this one runs. Selecting this scenario pulls its
   * dependencies into the run; a failed dependency skips it with `dependency_failed`.
   * Using it anywhere in a run switches that run from fail-fast to dependency-aware.
   */
  dependsOn?: string[];
  /** Keep this scenario's browser storage state (cookies + localStorage) after it passes. */
  saveSession?: boolean;
  /**
   * Browser context for this scenario:
   * - `shared` (default): keep the context left by the previous scenario.
   * - `restore`: new context seeded from the nearest `dependsOn` entry that saved a session.
   * - `fresh`: new empty context.
   */
  session?: ScenarioSessionMode;
  /**
   * Mobile only. Marks the one scenario that brings the app back to its signed-out start screen from any state. A real
   * iPhone cannot clear an app's data, so the runner runs this before a scenario that needs a fresh start. It is never run
   * or counted as a scenario of its own.
   */
  reset?: boolean;
  steps: StepBlock[];
}

export type ScenarioSessionMode = "shared" | "restore" | "fresh";

/**
 * How UI steps react when their primary selector is missing:
 * - `off`: primary selector only.
 * - `report` (default): fall back to `fallbacks` / `fingerprint`, keep running, report the heal.
 * - `auto`: as `report`, and mark the heal for automatic application to the scenario file.
 */
export type HealingPolicy = "off" | "report" | "auto";

/**
 * Identity of a UI target, recorded at authoring time and used to re-find the element
 * when every selector misses. Matched with Playwright's user-facing locators only.
 */
export interface TargetFingerprint {
  role?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  testId?: string;
  text?: string;
  /** Selector scoping the search, e.g. a dialog or form. */
  within?: string;
}

/**
 * Identity of a mobile element, recorded at authoring time and used to find it again when every locator misses. Only
 * `accessibilityId`, `resourceId`, `text` and `label` are matched today; `kind` and `within` are kept for the reviewer.
 */
export interface MobileFingerprint {
  /** Short class of the element, e.g. "Button", "EditText", "XCUIElementTypeButton". */
  kind?: string;
  /** The visible label the author saw. */
  label?: string;
  text?: string;
  /** Content description on Android, name on iOS. */
  accessibilityId?: string;
  /** Android resource id without the package prefix. */
  resourceId?: string;
  /** Nearest ancestor with an accessibility id. */
  within?: { by: string; value: string };
}

/**
 * A step can be written in a phase block (Given/When/Then/And) or as a flat op step.
 */
export type StepBlock =
  | { given: OpStep }
  | { when: OpStep }
  | { then: OpStep | OpStep[] }
  | { and: OpStep }
  | OpStep;

export interface OpStep {
  op: string;
  with?: Record<string, any>;
  saveAs?: string;
  name?: string;
  // spec is used by op "test.spec" to point to a registered custom spec implementation.
  spec?: string;
  timeoutMs?: number;
}
