// Purpose: API auth step registrations.

import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

type BearerFromLoginInput = {
  url: string;
  username: string;
  password: string;
};

export function registerAuthSteps(registry: StepRegistry): void {
  registry.register(
    "api.auth.bearerFromLogin",
    async (ctx: TestContext, step: OpStep) => {
      if (!ctx.api) {
        throw new Error(
          'Missing API adapter on context for op "api.auth.bearerFromLogin"',
        );
      }

      const input = (step.with ?? {}) as BearerFromLoginInput;
      if (!input.url) {
        throw new Error(
          'Missing "url" in step.with for op "api.auth.bearerFromLogin"',
        );
      }
      if (!input.username) {
        throw new Error(
          'Missing "username" in step.with for op "api.auth.bearerFromLogin"',
        );
      }
      if (!input.password) {
        throw new Error(
          'Missing "password" in step.with for op "api.auth.bearerFromLogin"',
        );
      }

      const response = await ctx.api.http({
        method: "POST",
        url: input.url,
        json: {
          username: input.username,
          password: input.password,
        },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(
          `Login failed with status ${response.status}: ${response.bodyText}`,
        );
      }

      const bodyJson = response.bodyJson as
        | { data?: { accessToken?: unknown }; accessToken?: unknown }
        | undefined;
      const token = bodyJson?.data?.accessToken ?? bodyJson?.accessToken;
      if (typeof token !== "string" || token.length === 0) {
        throw new Error("Missing access token in login response");
      }

      return token;
    },
  );
}
