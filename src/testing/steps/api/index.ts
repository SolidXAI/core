// Purpose: API step registrations.

import { StepRegistry } from "../../core/step-registry";
import { registerAuthSteps } from "./auth.step";
import { registerApiRequestStep } from "./request.step";

export function registerApiSteps(registry: StepRegistry): void {
  registerApiRequestStep(registry);
  registerAuthSteps(registry);
}
