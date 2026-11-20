import type { TestContext } from "../contracts/runtime-context.types";
import type { OpStep } from "../contracts/testing-metadata.types";

export type StepHandler = (ctx: TestContext, step: OpStep) => Promise<any>;

export interface StepOptions {
  /**
   * `with` fields handed to the handler as written, not interpolated: for a field whose own `${...}`
   * means something else, such as the JavaScript template literals in util.script's `script`.
   */
  rawWith?: string[];
}

export class StepRegistry {
  private readonly handlers = new Map<string, StepHandler>();
  private readonly rawWith = new Map<string, string[]>();

  register(op: string, handler: StepHandler, options: StepOptions = {}): void {
    if (this.handlers.has(op)) {
      throw new Error(`Step handler already registered for op: "${op}"`);
    }
    this.handlers.set(op, handler);
    if (options.rawWith?.length) {
      this.rawWith.set(op, options.rawWith);
    }
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

  /** The `with` fields of `op` that the engine must not interpolate; empty for most ops. */
  rawWithFields(op: string): string[] {
    return this.rawWith.get(op) ?? [];
  }

  ops(): string[] {
    return [...this.handlers.keys()].sort();
  }
}
