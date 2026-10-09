import { StepRegistry } from "../../core/step-registry";
import { registerAppSteps } from "./app.step";
import { registerActionSteps } from "./actions.step";
import { registerGestureSteps } from "./gestures.step";
import { registerAssertionSteps } from "./assertions.step";

export function registerMobileSteps(registry: StepRegistry): void {
  registerAppSteps(registry);
  registerActionSteps(registry);
  registerGestureSteps(registry);
  registerAssertionSteps(registry);
}
