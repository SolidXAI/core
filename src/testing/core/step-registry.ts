import type { TestContext } from "../contracts/runtime-context.types";
import type { OpStep } from "../contracts/testing-metadata.types";

export type StepHandler = (ctx: TestContext, step: OpStep) => Promise<any>;

export class StepRegistry {
  private readonly handlers = new Map<string, StepHandler>();

  register(op: string, handler: StepHandler): void {
    if (this.handlers.has(op)) {
      throw new Error(`Step handler already registered for op: "${op}"`);
    }
    this.handlers.set(op, handler);
  }

  get(op: string): StepHandler {
    const handler = this.handlers.get(op);
    if (!handler) {
      throw new Error(`No step handler registered for op: "${op}"`);
    }
    return handler;
  }

  has(op: string): boolean {
    return this.handlers.has(op);
  }
}
