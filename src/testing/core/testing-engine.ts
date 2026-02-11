import type { TestContext, StepPhase } from "../contracts/runtime-context.types";
import type { OpStep, ScenarioSpec } from "../contracts/testing-metadata.types";
import { interpolateDeep } from "./interpolation";
import { normalizeBlock } from "./normalize-steps";
import { StepRegistry } from "./step-registry";
import { withTimeout } from "./timeout";

export class TestingEngine {
  private readonly registry: StepRegistry;
  private readonly defaults?: { timeoutMs?: number; retries?: number };

  constructor(
    registry: StepRegistry,
    defaults?: { timeoutMs?: number; retries?: number },
  ) {
    this.registry = registry;
    this.defaults = defaults;
  }

  async runScenario(
    scenario: ScenarioSpec,
    ctxBase: Omit<TestContext, "scenarioId" | "scenarioType" | "params">,
  ): Promise<void> {
    const retries = scenario.retries ?? this.defaults?.retries ?? 0;
    const maxAttempts = Math.max(0, retries) + 1;
    const scenarioTimeoutMs =
      scenario.timeoutMs ?? this.defaults?.timeoutMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const ctx: TestContext = {
        ...ctxBase,
        scenarioId: scenario.id,
        scenarioType: scenario.type,
        params: scenario.params ?? {},
      };

      const reporter = ctx.reporter;
      const scenarioStart = Date.now();
      let scenarioError: unknown;

      reporter.onScenarioStart(scenario);

      try {
        const execute = async () => {
          for (const block of scenario.steps) {
            const normalized = normalizeBlock(block);
            await this.runBlock(normalized.phase, normalized.steps, ctx);
          }
        };

        if (scenarioTimeoutMs !== undefined) {
          await withTimeout(
            execute(),
            scenarioTimeoutMs,
            `Scenario timeout after ${scenarioTimeoutMs}ms: "${scenario.id}"`,
          );
        } else {
          await execute();
        }
      } catch (err) {
        scenarioError = err;
      } finally {
        const durationMs = Date.now() - scenarioStart;
        reporter.onScenarioEnd(scenario, {
          ok: !scenarioError,
          error: scenarioError,
          durationMs,
        });
      }

      if (!scenarioError) {
        return;
      }

      if (attempt >= maxAttempts) {
        throw scenarioError;
      }
    }
  }

  private async runBlock(
    phase: StepPhase,
    steps: OpStep[],
    ctx: TestContext,
  ): Promise<void> {
    for (const step of steps) {
      const reporter = ctx.reporter;
      const stepStart = Date.now();
      let stepError: unknown;
      let resolvedStep: OpStep | undefined;

      reporter.onStepStart({ scenarioId: ctx.scenarioId, phase, step });

      try {
        resolvedStep = interpolateDeep(step, ctx) as OpStep;
        const handler = this.registry.get(resolvedStep.op);
        const run = handler(ctx, resolvedStep);
        const result =
          resolvedStep.timeoutMs !== undefined
            ? await withTimeout(
              run,
              resolvedStep.timeoutMs,
              `Step timeout after ${resolvedStep.timeoutMs}ms: "${resolvedStep.op}"`,
            )
            : await run;

        if (resolvedStep.saveAs) {
          ctx.resources.set(resolvedStep.saveAs, result);
        }
      } catch (err) {
        stepError = err;
        throw err;
      } finally {
        const durationMs = Date.now() - stepStart;
        reporter.onStepEnd({
          scenarioId: ctx.scenarioId,
          phase,
          step: resolvedStep ?? step,
          ok: !stepError,
          error: stepError,
          durationMs,
        });
      }
    }
  }
}
