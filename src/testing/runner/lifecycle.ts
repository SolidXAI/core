import type { TestContext } from "../contracts/runtime-context.types";
import type { OpStep, ScenarioSpec, StepBlock } from "../contracts/testing-metadata.types";

type StartedFlag = { value: boolean };

function stepsFromBlock(block: StepBlock): OpStep[] {
  if ("given" in block) return [block.given];
  if ("when" in block) return [block.when];
  if ("and" in block) return [block.and];
  if ("then" in block) return Array.isArray(block.then) ? block.then : [block.then];
  return [block];
}

export function scenarioNeedsUi(scenario: ScenarioSpec): boolean {
  if (scenario.type === "ui" || scenario.type === "mixed") return true;
  for (const block of scenario.steps) {
    for (const step of stepsFromBlock(block)) {
      if (step.op.startsWith("ui.")) return true;
    }
  }
  return false;
}

export async function ensureUiStarted(
  ctxBase: Omit<TestContext, "scenarioId" | "scenarioType" | "params">,
  startedFlag: StartedFlag,
): Promise<void> {
  if (!ctxBase.ui || startedFlag.value) return;
  await ctxBase.ui.start();
  startedFlag.value = true;
}
