// Purpose: test.spec step registration.

import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";

export function registerTestSpecStep(registry: StepRegistry): void {
  registry.register("test.spec", async (ctx: TestContext, step: OpStep) => {
    const specId =
      step.spec ?? (step.with?.specId as string | undefined);
    if (!specId) {
      throw new Error(
        'Missing "spec" on step (or "specId" in step.with) for op "test.spec"',
      );
    }
    if (!ctx.specRegistry) {
      throw new Error('Missing specRegistry on context for op "test.spec"');
    }

    const input = (step.with?.input ?? {}) as Record<string, any>;
    const spec = ctx.specRegistry.create(specId);
    const result = await spec.run({ ctx, input });

    ctx.reporter.onSpecResult?.({
      scenarioId: ctx.scenarioId,
      specId,
      stepName: step.name,
      result,
    });

    if (result.attachments && ctx.reporter.attach) {
      for (const attachment of result.attachments) {
        const data =
          attachment.encoding === "base64"
            ? Buffer.from(attachment.data, "base64")
            : attachment.data;
        ctx.reporter.attach({
          scenarioId: ctx.scenarioId,
          name: attachment.name,
          contentType: attachment.contentType,
          data,
        });
      }
    }

    if (!result.ok) {
      throw new Error(`test.spec failed: ${specId}`);
    }

    return result;
  });
}
