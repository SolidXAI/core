// Purpose: HTTP assertion step registrations.

import type { ApiResponse, TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { attachJson } from "../../reporter/attachments";

type HttpStatusInput = { from?: ApiResponse; is: number };

export function registerHttpAssertSteps(registry: StepRegistry): void {
  registry.register("assert.httpStatus", async (ctx: TestContext, step: OpStep) => {
    const input = (step.with ?? {}) as HttpStatusInput;
    const response = input.from ?? ctx.last?.apiResponse;
    if (!response) {
      throw new Error('Missing ApiResponse for op "assert.httpStatus"');
    }
    if (input.is === undefined) {
      throw new Error('Missing "is" in step.with for op "assert.httpStatus"');
    }

    if (ctx.options?.printApiLogs && ctx.reporter.attach) {
      attachJson(ctx, "apiResponse", response);
    }

    if (response.status !== input.is) {
      const err = new Error(
        `Expected HTTP status ${input.is} but got ${response.status}`,
      );
      (err as any).httpResponseBody = response.bodyText;
      (err as any).httpStatus = response.status;
      (err as any).httpExpectedStatus = input.is;
      throw err;
    }
  });
}
