// Purpose: Test step registrations.

import { StepRegistry } from "../../core/step-registry";
import { registerTestSpecStep } from "./test-spec.step";

export function registerTestSteps(registry: StepRegistry): void {
  registerTestSpecStep(registry);
}
