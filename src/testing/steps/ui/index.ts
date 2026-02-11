import { StepRegistry } from "../../core/step-registry";
import { registerNavigationSteps } from "./navigation.step";
import { registerFormSteps } from "./form.step";
import { registerActionSteps } from "./actions.step";
import { registerAssertionSteps } from "./assertions.step";

export function registerUiSteps(registry: StepRegistry): void {
  registerNavigationSteps(registry);
  registerFormSteps(registry);
  registerActionSteps(registry);
  registerAssertionSteps(registry);
}
