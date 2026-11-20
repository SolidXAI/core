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

/** A step that wipes the app's data: a launch with `clearData`, or `mobile.reset`. */
function clearsData(step: OpStep): boolean {
  return step.op === "mobile.reset" || (step.op === "mobile.launch" && step.with?.clearData === true);
}

/** Whether a scenario's first step starts the app with its data cleared. */
export function startsWithCleanApp(scenario: ScenarioSpec): boolean {
  const first = scenario.steps[0];
  const step = first ? stepsFromBlock(first)[0] : undefined;
  return !!step && clearsData(step);
}

/**
 * The scenario with its first step turned into a plain launch, for an iOS device where the file's reset scenario has already
 * brought the app back to its start. Its other steps, and the step paths, stay as they are.
 */
export function withoutLeadingClear(scenario: ScenarioSpec): ScenarioSpec {
  if (!startsWithCleanApp(scenario)) return scenario;
  const [first, ...rest] = scenario.steps;
  const step = stepsFromBlock(first)[0];
  const { clearData: _cleared, ...kept } = (step.with ?? {}) as Record<string, unknown>;
  const launch: OpStep = { ...step, op: "mobile.launch", with: kept };
  let block: StepBlock;
  if ("given" in first) block = { ...first, given: launch };
  else if ("when" in first) block = { ...first, when: launch };
  else if ("and" in first) block = { ...first, and: launch };
  else if ("then" in first) block = { ...first, then: Array.isArray(first.then) ? [launch, ...first.then.slice(1)] : launch };
  else block = launch;
  return { ...scenario, steps: [block, ...rest] };
}

/**
 * What stops a run on an iOS device that cannot clear the app's data (no build to reinstall), before anything is started.
 * A scenario that starts clean can use the file's reset scenario instead, so only its absence is a problem; a scenario that
 * clears the data partway through has no such substitute. Undefined when nothing is in the way.
 */
export function cleanStartProblem(
  scenarios: ScenarioSpec[],
  device: { noReinstall: boolean },
  resetScenario?: ScenarioSpec,
): string | undefined {
  if (!device.noReinstall) return undefined;
  const problems: string[] = [];
  for (const scenario of scenarios) {
    if (!scenarioNeedsMobile(scenario)) continue;
    if (scenario.steps.flatMap(stepsFromBlock).slice(1).some(clearsData)) {
      problems.push(
        `Scenario "${scenario.id}" clears the app's data partway through, which needs a build to reinstall on this iOS device. Upload the build for this device (a Simulator .zip, or an iPhone .ipa).`,
      );
    }
    const startsClean = startsWithCleanApp(scenario) || scenario.session === "fresh" || scenario.session === "restore";
    if (startsClean && !resetScenario) {
      problems.push(
        `Scenario "${scenario.id}" starts with a clean app, but there is no build to reinstall on this iOS device and the file has no reset scenario. Upload the build for this device (a Simulator .zip, or an iPhone .ipa), or add a reset scenario.`,
      );
    }
  }
  return problems.length ? problems.join(" ") : undefined;
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
