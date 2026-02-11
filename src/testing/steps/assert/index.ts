// Purpose: Assert step registrations.

import { StepRegistry } from "../../core/step-registry";
import { registerHttpAssertSteps } from "./http.step";
import { registerJsonPathAssertSteps } from "./jsonpath.step";
import { registerPrimitiveAssertSteps } from "./primitives.step";

export function registerAssertSteps(registry: StepRegistry): void {
  registerPrimitiveAssertSteps(registry);
  registerHttpAssertSteps(registry);
  registerJsonPathAssertSteps(registry);
}
