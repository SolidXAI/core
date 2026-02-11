// Purpose: API request step handler registration.

import type { ApiRequestOptions } from "../../adapters/api/api.types";
import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type ApiRequestInput = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  json?: unknown;
  bodyText?: string;
};

export function registerApiRequestStep(registry: StepRegistry): void {
  registry.register("api.request", async (ctx: TestContext, step: OpStep) => {
    if (!ctx.api) {
      throw new Error('Missing API adapter on context for op "api.request"');
    }

    const input = (step.with ?? {}) as ApiRequestInput;
    if (!input.method) {
      throw new Error('Missing "method" in step.with for op "api.request"');
    }
    if (!input.url) {
      throw new Error('Missing "url" in step.with for op "api.request"');
    }

    const req: ApiRequestOptions = {
      method: input.method,
      url: input.url,
      headers: input.headers,
      json: input.json,
      bodyText: input.bodyText,
    };

    const response = await ctx.api.http(req);
    ctx.last = { ...(ctx.last ?? {}), apiResponse: response };

    return {
      status: response.status,
      headers: response.headers,
      bodyText: response.bodyText,
      bodyJson: response.bodyJson,
      body: response.bodyJson ?? response.bodyText,
    };
  });
}
