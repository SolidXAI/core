import { createHash } from "node:crypto";
import type { ScenarioSpec, SetupSpec, StepBlock } from "../contracts/testing-metadata.types";
import { normalizeBlock } from "../core/normalize-steps";
import { parseRestoreFrom } from "./restore-ref";

export interface IndependentValidation {
  /** Setup id → why it cannot run (cycle, unknown parent, missing ready, bad first ready step, duplicate id). */
  setupErrors: Map<string, string>;
  /** Scenario id → why it cannot run (forbidden field, unknown restoreFrom, restoreFrom names a scenario, bad dependsOn). */
  scenarioErrors: Map<string, string>;
}

const ARROW = " → ";

/**
 * Checks everything an independent run needs before it starts. Problems are returned, not thrown, so one broken
 * scenario or setup fails only itself. Mobile scenarios are skipped: they keep the legacy rules.
 */
export function validateIndependent(scenarios: ScenarioSpec[], setups: SetupSpec[]): IndependentValidation {
  const setupErrors = new Map<string, string>();
  const scenarioErrors = new Map<string, string>();

  const scenarioIds = new Set(scenarios.map((s) => s.id));
  const scenarioById = new Map<string, ScenarioSpec>();
  for (const s of scenarios) if (!scenarioById.has(s.id)) scenarioById.set(s.id, s);
  const setupById = new Map<string, SetupSpec>();
  const setupCount = new Map<string, number>();
  for (const s of setups) {
    if (!setupById.has(s.id)) setupById.set(s.id, s);
    setupCount.set(s.id, (setupCount.get(s.id) ?? 0) + 1);
  }

  for (const s of setups) {
    if ((setupCount.get(s.id) ?? 0) > 1 || scenarioIds.has(s.id)) {
      setupErrors.set(s.id, `Setup "${s.id}" has the same id as another scenario or setup`);
    }
  }
  for (const s of setups) {
    if (setupErrors.has(s.id)) continue;
    const error = ownSetupError(s, setupById);
    if (error) setupErrors.set(s.id, error);
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const s of setups) {
      if (setupErrors.has(s.id) || !s.from) continue;
      if (setupErrors.has(s.from)) {
        setupErrors.set(s.id, `Setup "${s.id}": its parent "${s.from}" is invalid`);
        changed = true;
      }
    }
  }

  const nonMobile = scenarios.filter((s) => s.type !== "mobile");
  const nonMobileIds = new Set(nonMobile.map((s) => s.id));
  const dependsNext = (id: string): string[] =>
    (scenarioById.get(id)?.dependsOn ?? []).filter((d) => nonMobileIds.has(d));
  for (const s of nonMobile) {
    const error = ownScenarioError(s, { scenarioById, scenarioIds, setupById, setupErrors, dependsNext });
    if (error) scenarioErrors.set(s.id, error);
  }

  return { setupErrors, scenarioErrors };
}

/** Root first, ends with setupId. Stops at a missing parent or a cycle, so it always terminates. */
export function setupChain(setupId: string, byId: Map<string, SetupSpec>): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let id: string | undefined = setupId;
  while (id !== undefined && byId.has(id) && !seen.has(id)) {
    seen.add(id);
    chain.unshift(id);
    id = byId.get(id)?.from;
  }
  return chain;
}

/**
 * sha256 hex of the chain's setups as JSON with sorted keys. Editing any setup in the chain changes it. The deprecated
 * `scope` is left out, so adding or removing it does not invalidate a setup's stored state.
 */
export function setupHash(setupId: string, byId: Map<string, SetupSpec>): string {
  const body = setupChain(setupId, byId)
    .map((id) => {
      const { scope: _ignored, ...setup } = byId.get(id) as SetupSpec;
      return JSON.stringify(sortKeys(setup));
    })
    .join("\n");
  return createHash("sha256").update(body).digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((k) => [k, sortKeys(record[k])]));
  }
  return value;
}

function firstOp(block: StepBlock | undefined): string | undefined {
  return block === undefined ? undefined : normalizeBlock(block).steps[0]?.op;
}

/** The op of the first `ui.*` step, skipping api, util and assert steps before it, or undefined when there is none. */
function firstUiOp(blocks: StepBlock[]): string | undefined {
  for (const block of blocks) {
    const op = normalizeBlock(block).steps.find((step) => step.op?.startsWith("ui."))?.op;
    if (op !== undefined) return op;
  }
  return undefined;
}

/**
 * The cycle through `start` as ids, `start` first and last (for example a → b → a), or undefined when `start` is not on
 * a cycle. `next` lists the ids one step further along.
 */
function cycleThrough(start: string, next: (id: string) => string[]): string[] | undefined {
  const parent = new Map<string, string>();
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const n of next(current)) {
      if (n === start) {
        const path = [current];
        let p = current;
        while (p !== start) {
          p = parent.get(p) as string;
          path.unshift(p);
        }
        return [...path, start];
      }
      if (!seen.has(n)) {
        seen.add(n);
        parent.set(n, current);
        queue.push(n);
      }
    }
  }
  return undefined;
}

/** The problem with a setup on its own (not counting its parents), or undefined. */
function ownSetupError(setup: SetupSpec, setupById: Map<string, SetupSpec>): string | undefined {
  if (setup.from !== undefined) {
    if (!setupById.has(setup.from)) return `Setup "${setup.id}" builds on unknown setup "${setup.from}"`;
    const cycle = cycleThrough(setup.id, (id) => {
      const from = setupById.get(id)?.from;
      return from !== undefined && setupById.has(from) ? [from] : [];
    });
    if (cycle) return `Setup "${setup.id}" is part of a from cycle: ${cycle.join(ARROW)}`;
  }
  const ready = setup.ready ?? [];
  if ((setup.type === "ui" || setup.type === "mixed") && ready.length === 0) {
    return `Setup "${setup.id}" needs ready steps (ui and mixed setups)`;
  }
  if (ready.length > 0 && firstOp(ready[0]) !== "ui.goto") {
    return `Setup "${setup.id}": the first ready step must be ui.goto`;
  }
  return undefined;
}

/** The problem with a ui, api or mixed scenario, or undefined. */
function ownScenarioError(
  scenario: ScenarioSpec,
  ctx: {
    scenarioById: Map<string, ScenarioSpec>;
    scenarioIds: Set<string>;
    setupById: Map<string, SetupSpec>;
    setupErrors: Map<string, string>;
    dependsNext: (id: string) => string[];
  },
): string | undefined {
  const id = scenario.id;
  if (scenario.session === "shared" || scenario.session === "restore") {
    return `Scenario "${id}": session "${scenario.session}" is not allowed for ui and api scenarios; run the migration`;
  }
  if (scenario.saveSession) {
    return `Scenario "${id}": saveSession is not allowed for ui and api scenarios; run the migration`;
  }
  if (scenario.restoreFrom !== undefined) {
    const parsed = parseRestoreFrom(scenario.restoreFrom);
    if (parsed && "error" in parsed) return `Scenario "${id}": ${parsed.error}`;
    const setupId = (parsed as { setupId: string }).setupId;
    if (ctx.scenarioIds.has(setupId)) {
      return `Scenario "${id}": restoreFrom must name a setup; run the migration ("${setupId}" is a scenario)`;
    }
    if (!ctx.setupById.has(setupId)) return `Scenario "${id}": restoreFrom names unknown setup "${setupId}"`;
    const setupError = ctx.setupErrors.get(setupId);
    if (setupError !== undefined) return `Scenario "${id}": its setup "${setupId}" is invalid: ${setupError}`;
  }
  const deps = scenario.dependsOn ?? [];
  const unknown = deps.find((d) => !ctx.scenarioById.has(d));
  if (unknown !== undefined) return `Scenario "${id}" depends on unknown scenario "${unknown}"`;
  const cycle = cycleThrough(id, ctx.dependsNext);
  if (cycle) return `Scenario "${id}" is part of a dependsOn cycle: ${cycle.join(ARROW)}`;
  if (scenario.type === "ui" || scenario.type === "mixed") {
    const op = firstUiOp(scenario.steps ?? []);
    if (op !== undefined && op !== "ui.goto") return `Scenario "${id}": the first ui step must be ui.goto`;
  }
  return undefined;
}
