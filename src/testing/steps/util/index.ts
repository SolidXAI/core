import { StepRegistry } from "../../core/step-registry";
import { registerLogStep } from "./log.step";
import { registerSleepStep } from "./sleep.step";
import { registerRequireStep } from "./require.step";
import { registerRandomStep } from "./random.step";
import { registerNowStep } from "./now.step";
import { registerScriptStep } from "./script.step";

export function registerUtilSteps(registry: StepRegistry): void {
  registerLogStep(registry);
  registerSleepStep(registry);
  registerRequireStep(registry);
  registerRandomStep(registry);
  registerNowStep(registry);
  registerScriptStep(registry);
}
