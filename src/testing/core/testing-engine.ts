import type { TestContext, StepPhase } from "../contracts/runtime-context.types";
import type { OpStep, ScenarioSpec, StepBlock } from "../contracts/testing-metadata.types";
import { interpolateDeep } from "./interpolation";
import { normalizeBlock } from "./normalize-steps";
import { StepRegistry } from "./step-registry";
import { scenarioNeedsMobile } from "../runner/lifecycle";
import { withTimeout } from "./timeout";

/**
 * Path of a step inside `scenario.steps`, matching the file layout so a consumer can
 * patch the exact step: `steps[2]`, `steps[3].when`, `steps[5].then[1]`.
 */
export function stepPathFor(block: StepBlock, blockIndex: number, stepIndex: number): string {
  const base = `steps[${blockIndex}]`;
  if ("given" in block) return `${base}.given`;
  if ("when" in block) return `${base}.when`;
  if ("and" in block) return `${base}.and`;
  if ("then" in block) {
    return Array.isArray(block.then) ? `${base}.then[${stepIndex}]` : `${base}.then`;
  }
  return base;
}

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
      // Start a clean capture window for this scenario (UI adapter buffers console/network
      // events; they're only flushed to the reporter if the scenario fails below).
      ctx.ui?.resetCapture();
      const usesMobile = scenarioNeedsMobile(scenario) && !!ctx.mobile?.isStarted();
      if (usesMobile) await ctx.mobile?.resetCapture();

      try {
        const execute = async () => {
          for (const [blockIndex, block] of scenario.steps.entries()) {
            const normalized = normalizeBlock(block);
            for (const [stepIndex, step] of normalized.steps.entries()) {
              await this.runStep(normalized.phase, step, ctx, stepPathFor(block, blockIndex, stepIndex));
            }
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
      } catch (err: any) {
        scenarioError = err;
      } finally {
        // On failure, flush the UI adapter's captured artifacts (console + network) BEFORE
        // onScenarioEnd — the lifecycle reporter snapshots the attached artifacts inside
        // onScenarioEnd. No page (e.g. API scenarios) → nothing captured.
        if (scenarioError && ctx.ui?.page && reporter.attach) {
          try {
            const artifacts = await ctx.ui.collectFailureArtifacts();
            for (const a of artifacts) {
              reporter.attach({
                scenarioId: ctx.scenarioId,
                name: a.name,
                contentType: a.contentType,
                data: a.data,
              });
            }
          } catch {
            // Artifact capture is best-effort; never let it mask the scenario error.
          }
        }

        // Same for a mobile scenario: device log and a screenshot of the failing screen.
        if (scenarioError && usesMobile && reporter.attach) {
          try {
            const artifacts = (await ctx.mobile?.collectFailureArtifacts()) ?? [];
            for (const a of artifacts) {
              reporter.attach({
                scenarioId: ctx.scenarioId,
                name: a.name,
                contentType: a.contentType,
                data: a.data,
              });
            }
          } catch {
            // Best-effort, like the UI artifacts above.
          }
        }

        const durationMs = Date.now() - scenarioStart;
        const heals = ctx.ui?.getHeals() ?? [];
        reporter.onScenarioEnd(scenario, {
          ok: !scenarioError,
          error: scenarioError,
          durationMs,
          ...(heals.length ? { heals } : {}),
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

  // Interpolates the step, except the `with` fields its op takes as written (StepOptions.rawWith).
  private resolveStep(step: OpStep, ctx: TestContext): OpStep {
    const raw = this.registry
      .rawWithFields(step.op)
      .filter((field) => step.with && typeof step.with === "object" && field in step.with);
    if (!raw.length) {
      return interpolateDeep(step, ctx);
    }
    const rest = { ...step.with };
    for (const field of raw) delete rest[field];
    const resolved = interpolateDeep({ ...step, with: rest }, ctx);
    const kept = Object.fromEntries(raw.map((field) => [field, step.with![field]]));
    return { ...resolved, with: { ...resolved.with, ...kept } };
  }

  /**
   * Run one step exactly as a scenario would: interpolate, dispatch, honor `timeoutMs`,
   * store `saveAs`, and report start/end. Throws the step's error.
   */
  async runStep(
    phase: StepPhase,
    step: OpStep,
    ctx: TestContext,
    stepPath?: string,
  ): Promise<unknown> {
    const reporter = ctx.reporter;
    const stepStart = Date.now();
    let stepError: unknown;
    let resolvedStep: OpStep | undefined;
    let result: unknown;

    ctx.stepPath = stepPath;
    reporter.onStepStart({ scenarioId: ctx.scenarioId, phase, step, stepPath });

    try {
      resolvedStep = this.resolveStep(step, ctx);
      const handler = this.registry.get(resolvedStep.op);
      const run = handler(ctx, resolvedStep);
      result =
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
      return result;
    } catch (err: any) {
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
        stepPath,
      });
    }
  }
}
