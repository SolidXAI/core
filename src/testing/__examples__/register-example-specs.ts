import { SpecRegistry } from "../core/spec-registry";
import { CustomHealthSpec } from "./specs/custom-health.spec";

export function registerExampleSpecs(specRegistry: SpecRegistry): void {
  specRegistry.register("example.customHealth", () => new CustomHealthSpec());
}
