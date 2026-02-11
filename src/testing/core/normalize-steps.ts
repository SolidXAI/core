import type { StepPhase } from "../contracts/runtime-context.types";
import type { OpStep, StepBlock } from "../contracts/testing-metadata.types";

export function normalizeBlock(
  block: StepBlock,
): { phase: StepPhase; steps: OpStep[] } {
  if ("given" in block) {
    return { phase: "given", steps: [block.given] };
  }
  if ("when" in block) {
    return { phase: "when", steps: [block.when] };
  }
  if ("then" in block) {
    const steps = Array.isArray(block.then) ? block.then : [block.then];
    return { phase: "then", steps };
  }
  if ("and" in block) {
    return { phase: "and", steps: [block.and] };
  }
  return { phase: "step", steps: [block] };
}
