// Purpose: JSONPath assertion step registrations.

import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type JsonPathInput = { from: any; path: string; equals: any };

function resolveJsonPath(from: any, path: string): unknown {
  let normalized = path.trim();
  if (normalized.startsWith("$.")) {
    normalized = normalized.slice(2);
  } else if (normalized === "$") {
    return from;
  }

  normalized = normalized.replace(/\[(\d+)\]/g, ".$1");
  const parts = normalized.split(".").filter(Boolean);

  let current: any = from;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export function registerJsonPathAssertSteps(registry: StepRegistry): void {
  registry.register("assert.jsonPath", async (_ctx: TestContext, step: OpStep) => {
    const input = (step.with ?? {}) as JsonPathInput;
    if (!("from" in input)) {
      throw new Error('Missing "from" in step.with for op "assert.jsonPath"');
    }
    if (!input.path) {
      throw new Error('Missing "path" in step.with for op "assert.jsonPath"');
    }
    if (!("equals" in input)) {
      throw new Error('Missing "equals" in step.with for op "assert.jsonPath"');
    }

    const actual = resolveJsonPath(input.from, input.path);
    if (actual !== input.equals) {
      throw new Error(
        `Expected JSONPath "${input.path}" to equal ${String(
          input.equals,
        )} but got ${String(actual)}`,
      );
    }
  });
}
