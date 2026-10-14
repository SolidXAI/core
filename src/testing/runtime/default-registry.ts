import { StepRegistry } from "../core/step-registry";
import { registerApiSteps } from "../steps/api";
import { registerAssertSteps } from "../steps/assert";
import { registerTestSteps } from "../steps/test";
import { registerUiSteps } from "../steps/ui";
import { registerUtilSteps } from "../steps/util";

/** Registry with every built-in op, shared by the runner and the step executor. */
export function createDefaultStepRegistry(): StepRegistry {
  const registry = new StepRegistry();
  registerApiSteps(registry);
  registerUiSteps(registry);
  registerAssertSteps(registry);
  registerUtilSteps(registry);
  registerTestSteps(registry);
  return registry;
}
