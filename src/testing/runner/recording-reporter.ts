// Test helper: a reporter that records what it was given. Not used at runtime.
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import type { BlockedBy, Reporter, ScenarioSetupInfo } from "../reporter/reporter.types";

export class RecordingReporter implements Reporter {
  scenarioEnds: Array<{ id: string; ok: boolean }> = [];
  /** The heals each scenario reported, by scenario id. */
  heals: Record<string, unknown[]> = {};
  attachments: Array<{ scenarioId: string; name: string }> = [];
  runArtifacts: Array<{ name: string; bytes: number }> = [];
  runEnd?: { ok: boolean; total: number; passed: number; failed: number; blocked?: number };
  /** Scenarios that did not run, with the reason. */
  blocked: Array<{ id: string; blockedBy: BlockedBy }> = [];
  /** Setup attempts that ended, by setup id. */
  setupEnds: Array<{ setupId: string; ok: boolean; reused: boolean; attempt: number }> = [];
  teardownEnds: Array<{ setupId: string; ok: boolean }> = [];
  /** Setup info reported for each consumer scenario. */
  scenarioSetups: Record<string, ScenarioSetupInfo> = {};
  stepEnds: Array<{ scenarioId?: string; op: string; stepPath?: string; setup?: string; ok?: boolean; slowestCallMs?: number }> = [];

  onScenarioStart() {}
  onScenarioEnd(scenario: ScenarioSpec, result: { ok: boolean; heals?: unknown[] }) {
    this.scenarioEnds.push({ id: scenario.id, ok: result.ok });
    if (result.heals?.length) this.heals[scenario.id] = result.heals;
  }
  onStepStart() {}
  onStepEnd(args?: { scenarioId?: string; step: { op: string }; stepPath?: string; setup?: string; ok?: boolean; slowestCallMs?: number }) {
    if (args) {
      this.stepEnds.push({ scenarioId: args.scenarioId, op: args.step.op, stepPath: args.stepPath, setup: args.setup, ok: args.ok, slowestCallMs: args.slowestCallMs });
    }
  }
  onScenarioBlocked(scenario: ScenarioSpec, blockedBy: BlockedBy) {
    this.blocked.push({ id: scenario.id, blockedBy });
  }
  onSetupEnd(args: { setupId: string; ok: boolean; reused: boolean; attempt: number }) {
    this.setupEnds.push({ setupId: args.setupId, ok: args.ok, reused: args.reused, attempt: args.attempt });
  }
  onTeardownEnd(args: { setupId: string; ok: boolean }) {
    this.teardownEnds.push({ setupId: args.setupId, ok: args.ok });
  }
  onScenarioSetup(scenarioId: string, info: ScenarioSetupInfo) {
    this.scenarioSetups[scenarioId] = info;
  }
  attach(args: { scenarioId: string; name: string }) {
    this.attachments.push({ scenarioId: args.scenarioId, name: args.name });
  }
  attachRunArtifact(args: { name: string; data: Buffer | string }) {
    this.runArtifacts.push({ name: args.name, bytes: Buffer.byteLength(args.data) });
  }
  onRunEnd(args: { ok: boolean; total: number; passed: number; failed: number; blocked?: number }) {
    this.runEnd = args;
  }
}
