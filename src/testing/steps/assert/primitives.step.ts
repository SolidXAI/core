// Purpose: Primitive assertion step registrations.

import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type EqualsInput = { actual: unknown; expected: unknown };
type ContainsInput = { actual: string; expected: string };
type MatchesInput = { actual: string; pattern: string };

export function registerPrimitiveAssertSteps(registry: StepRegistry): void {
  registry.register("assert.equals", async (_ctx: TestContext, step: OpStep) => {
    const input = (step.with ?? {}) as EqualsInput;
    if (!("actual" in input)) {
      throw new Error('Missing "actual" in step.with for op "assert.equals"');
    }
    if (!("expected" in input)) {
      throw new Error('Missing "expected" in step.with for op "assert.equals"');
    }
    if (input.actual !== input.expected) {
      throw new Error(
        `Expected values to be equal. Actual: ${String(
          input.actual,
        )}, Expected: ${String(input.expected)}`,
      );
    }
  });

  registry.register(
    "assert.contains",
    async (_ctx: TestContext, step: OpStep) => {
      const input = (step.with ?? {}) as ContainsInput;
      if (!input.actual) {
        throw new Error('Missing "actual" in step.with for op "assert.contains"');
      }
      if (input.expected === undefined) {
        throw new Error(
          'Missing "expected" in step.with for op "assert.contains"',
        );
      }
      if (!input.actual.includes(input.expected)) {
        throw new Error(
          `Expected "${input.actual}" to contain "${input.expected}"`,
        );
      }
    },
  );

  registry.register(
    "assert.matches",
    async (_ctx: TestContext, step: OpStep) => {
      const input = (step.with ?? {}) as MatchesInput;
      if (!input.actual) {
        throw new Error('Missing "actual" in step.with for op "assert.matches"');
      }
      if (!input.pattern) {
        throw new Error(
          'Missing "pattern" in step.with for op "assert.matches"',
        );
      }
      const regex = new RegExp(input.pattern);
      if (!regex.test(input.actual)) {
        throw new Error(
          `Expected "${input.actual}" to match /${input.pattern}/`,
        );
      }
    },
  );
}
