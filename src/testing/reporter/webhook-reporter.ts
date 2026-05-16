import { ConsoleReporter } from "./console-reporter";
import type { OpStep, ScenarioSpec } from "../contracts/testing-metadata.types";
import type { StepPhase } from "../contracts/runtime-context.types";

interface TestStepResult {
  phase: string;
  operation: string;
  name?: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

interface TestScenarioResult {
  id: string;
  name?: string;
  ok: boolean;
  durationMs: number;
  error?: string;
  steps: TestStepResult[];
}

export interface TestRunPayload {
  runName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number;
  total: number;
  passed: number;
  failed: number;
  scenarios: TestScenarioResult[];
}

function formatError(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) return err.stack || err.message;
  return String(err);
}

export class WebhookReporter extends ConsoleReporter {
  private readonly startedAt = new Date();
  private readonly accumulated: TestScenarioResult[] = [];
  private currentSteps: TestStepResult[] = [];

  constructor(
    private readonly webhookUrl: string,
    private readonly runName: string,
  ) {
    super();
  }

  override onStepEnd(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
  }): void {
    super.onStepEnd(args);
    this.currentSteps.push({
      phase: String(args.phase),
      operation: args.step.op,
      name: args.step.name,
      ok: args.ok,
      durationMs: args.durationMs,
      error: args.error ? formatError(args.error) : undefined,
    });
  }

  override onScenarioEnd(
    scenario: ScenarioSpec,
    result: { ok: boolean; error?: unknown; durationMs: number },
  ): void {
    super.onScenarioEnd(scenario, result);
    this.accumulated.push({
      id: scenario.id,
      name: scenario.name,
      ok: result.ok,
      durationMs: result.durationMs,
      error: result.error ? formatError(result.error) : undefined,
      steps: [...this.currentSteps],
    });
    this.currentSteps = [];
  }

  async flush(exitCode: number): Promise<void> {
    const completedAt = new Date();
    const payload: TestRunPayload = {
      runName: this.runName,
      startedAt: this.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - this.startedAt.getTime(),
      exitCode,
      total: this.accumulated.length,
      passed: this.accumulated.filter((s) => s.ok).length,
      failed: this.accumulated.filter((s) => !s.ok).length,
      scenarios: this.accumulated,
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        console.warn(`[WebhookReporter] Webhook returned ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`[WebhookReporter] Failed to deliver test results: ${err}`);
    }
  }
}
