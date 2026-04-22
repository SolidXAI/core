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
