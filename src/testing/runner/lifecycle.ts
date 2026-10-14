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

export function scenarioNeedsMobile(scenario: ScenarioSpec): boolean {
  if (scenario.type === "mobile") return true;
  for (const block of scenario.steps) {
    for (const step of stepsFromBlock(block)) {
      if (step.op.startsWith("mobile.")) return true;
    }
  }
  return false;
}

/**
 * A mobile scenario drives a device, not a browser, so `ui.*` steps have nothing to act on (D3).
 * Returns a message when the scenario mixes them, otherwise undefined.
 */
export function mobileScenarioProblem(scenario: ScenarioSpec): string | undefined {
  if (scenario.type !== "mobile") return undefined;
  for (const block of scenario.steps) {
    for (const step of stepsFromBlock(block)) {
      if (step.op.startsWith("ui.")) {
        return `Scenario "${scenario.id}" is a mobile scenario but uses "${step.op}". ui.* steps are not allowed in a mobile scenario; use mobile.* steps`;
      }
    }
  }
  return undefined;
}

export async function ensureUiStarted(
  ctxBase: Omit<TestContext, "scenarioId" | "scenarioType" | "params">,
  startedFlag: StartedFlag,
): Promise<void> {
  if (!ctxBase.ui || startedFlag.value) return;
  await ctxBase.ui.start();
  startedFlag.value = true;
}

export async function ensureMobileStarted(
  ctxBase: Omit<TestContext, "scenarioId" | "scenarioType" | "params">,
  startedFlag: StartedFlag,
): Promise<void> {
  if (!ctxBase.mobile || startedFlag.value) return;
  await ctxBase.mobile.start();
  startedFlag.value = true;
}
