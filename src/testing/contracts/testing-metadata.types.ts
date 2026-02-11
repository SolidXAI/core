export type ScenarioType = "api" | "ui" | "mixed";

export interface TestingMetadata {
  testing: {
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
  timeoutMs?: number;
}
