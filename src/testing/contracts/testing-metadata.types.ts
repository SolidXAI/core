export type ScenarioType = "api" | "ui" | "mixed";

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
  steps: StepBlock[];
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
