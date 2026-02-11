import type { ISolidTestSpec } from "../contracts/test-spec.types";

export type SpecFactory = () => ISolidTestSpec;

export class SpecRegistry {
  private readonly factories = new Map<string, SpecFactory>();

  register(specId: string, factory: SpecFactory): void {
    if (!specId) {
      throw new Error("specId is required");
    }
    if (this.factories.has(specId)) {
      throw new Error(`Spec already registered: "${specId}"`);
    }
    this.factories.set(specId, factory);
  }

  create(specId: string): ISolidTestSpec {
    const factory = this.factories.get(specId);
    if (!factory) {
      throw new Error(`Spec not registered: "${specId}"`);
    }
    return factory();
  }

  has(specId: string): boolean {
    return this.factories.has(specId);
  }

  list(): string[] {
    return Array.from(this.factories.keys()).sort();
  }
}
