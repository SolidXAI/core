// Test helper: a reporter that records what it was given. Not used at runtime.
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import type { Reporter } from "../reporter/reporter.types";

export class RecordingReporter implements Reporter {
  scenarioEnds: Array<{ id: string; ok: boolean }> = [];
  attachments: Array<{ scenarioId: string; name: string }> = [];
  runArtifacts: Array<{ name: string; bytes: number }> = [];
  runEnd?: { ok: boolean; total: number; passed: number; failed: number };

  onScenarioStart() {}
  onScenarioEnd(scenario: ScenarioSpec, result: { ok: boolean }) {
    this.scenarioEnds.push({ id: scenario.id, ok: result.ok });
  }
  onStepStart() {}
  onStepEnd() {}
  attach(args: { scenarioId: string; name: string }) {
    this.attachments.push({ scenarioId: args.scenarioId, name: args.name });
  }
  attachRunArtifact(args: { name: string; data: Buffer | string }) {
    this.runArtifacts.push({ name: args.name, bytes: Buffer.byteLength(args.data) });
  }
  onRunEnd(args: { ok: boolean; total: number; passed: number; failed: number }) {
    this.runEnd = args;
  }
}
