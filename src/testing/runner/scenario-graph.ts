import type { ScenarioSpec } from "../contracts/testing-metadata.types";

export function usesDependencies(scenarios: ScenarioSpec[]): boolean {
  return scenarios.some(
    (s) =>
      (Array.isArray(s.dependsOn) && s.dependsOn.length > 0) || s.restoreFrom || s.saveSession || (s.session && s.session !== "shared"),
  );
}

/**
 * Turns `restoreFrom` into the fields the rest of the runner already understands, once, before anything else reads the file:
 * a scenario with `restoreFrom: X` gets X first in its `dependsOn` and `session: "restore"`, and X gets `saveSession: true`.
 * Everything downstream (ordering, cycle checks, pulling a dependency in past a tag filter, saving and restoring a session)
 * then works unchanged. Returns copies; the input is not modified. Throws, before any scenario runs, when X does not exist,
 * is the scenario itself or the reset scenario, or when `session` is set to something other than "restore".
 */
export function expandRestoreFrom(scenarios: ScenarioSpec[], resetId?: string): ScenarioSpec[] {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const sources = new Set<string>();
  const expanded = scenarios.map((scenario) => {
    if (scenario.restoreFrom === undefined) return scenario;
    const problem = restoreFromProblem(scenario, byId, resetId);
    if (problem) throw new Error(problem);
    const source = typeof scenario.restoreFrom === "string" ? scenario.restoreFrom : undefined;
    if (source === undefined) throw new Error(`Scenario "${scenario.id}" has an invalid restoreFrom (expected one scenario id)`);
    sources.add(source);
    const others = dependenciesOf(scenario).filter((id) => id !== source);
    const before = dependenciesOf(scenario);
    const dependsOn = before.includes(source) ? before : [source, ...others];
    return { ...scenario, dependsOn, session: "restore" as const };
  });
  return expanded.map((scenario) => (sources.has(scenario.id) && !scenario.saveSession ? { ...scenario, saveSession: true } : scenario));
}

/** What is wrong with a scenario's `restoreFrom`, or undefined when it names another scenario it can restore from. */
function restoreFromProblem(scenario: ScenarioSpec, byId: Map<string, ScenarioSpec>, resetId?: string): string | undefined {
  const source = scenario.restoreFrom;
  if (source === undefined) return undefined;
  if (typeof source !== "string" || !source.trim()) return `Scenario "${scenario.id}" has an invalid restoreFrom (expected one scenario id)`;
  if (source === scenario.id) return `Scenario "${scenario.id}" cannot restoreFrom itself`;
  if (resetId !== undefined && source === resetId) {
    return `Scenario "${scenario.id}" restores from the reset scenario "${source}", which only runs as setup`;
  }
  if (!byId.has(source)) return `Scenario "${scenario.id}" restores from unknown scenario "${source}"`;
  if (scenario.session !== undefined && scenario.session !== "restore") {
    return `Scenario "${scenario.id}" has restoreFrom, which means session "restore", but its session is "${String(scenario.session)}"`;
  }
  return undefined;
}

/** A scenario that cannot run in this run: its own reference is broken (`error`), or one it needs cannot run (`blockedBy`). */
export interface UnrunnableScenario {
  scenario: ScenarioSpec;
  error?: string;
  blockedBy?: string;
}

/**
 * Sets aside the scenarios whose `restoreFrom` or `dependsOn` cannot be met — one naming a scenario that does not exist,
 * itself, or the reset scenario — and, transitively, the scenarios that need them. A mistake in one scenario then fails
 * that scenario instead of stopping the whole run before anything starts; the rest run as usual.
 */
export function splitUnrunnable(scenarios: ScenarioSpec[], resetId?: string): { runnable: ScenarioSpec[]; unrunnable: UnrunnableScenario[] } {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const unrunnable = new Map<string, UnrunnableScenario>();
  for (const scenario of scenarios) {
    const unknownDep = dependenciesOf(scenario).find((id) => !byId.has(id));
    const error = restoreFromProblem(scenario, byId, resetId)
      ?? (unknownDep !== undefined ? `Scenario "${scenario.id}" depends on unknown scenario "${unknownDep}"` : undefined);
    if (error) unrunnable.set(scenario.id, { scenario, error });
  }
  for (let grew = unrunnable.size > 0; grew; ) {
    grew = false;
    for (const scenario of scenarios) {
      if (unrunnable.has(scenario.id)) continue;
      const needs = [...dependenciesOf(scenario), ...(typeof scenario.restoreFrom === "string" ? [scenario.restoreFrom] : [])];
      const blockedBy = needs.find((id) => unrunnable.has(id));
      if (blockedBy !== undefined) {
        unrunnable.set(scenario.id, { scenario, blockedBy });
        grew = true;
      }
    }
  }
  return { runnable: scenarios.filter((s) => !unrunnable.has(s.id)), unrunnable: [...unrunnable.values()] };
}

function dependenciesOf(scenario: ScenarioSpec): string[] {
  return Array.isArray(scenario.dependsOn) ? scenario.dependsOn.map(String) : [];
}

/**
 * Add every transitive `dependsOn` of `selected`, taken from `all`. A dependency is
 * pulled in even when the tag filter or skip list excluded it, because the dependent
 * cannot run without it. Throws on a dependency id that does not exist.
 */
export function expandWithDependencies(all: ScenarioSpec[], selected: ScenarioSpec[]): ScenarioSpec[] {
  const byId = new Map(all.map((s) => [s.id, s]));
  const included = new Set(selected.map((s) => s.id));
  const queue = [...selected];
  while (queue.length) {
    const scenario = queue.shift()!;
    for (const depId of dependenciesOf(scenario)) {
      const dep = byId.get(depId);
      if (!dep) {
        throw new Error(`Scenario "${scenario.id}" depends on unknown scenario "${depId}"`);
      }
      if (!included.has(depId)) {
        included.add(depId);
        queue.push(dep);
      }
    }
  }
  return all.filter((s) => included.has(s.id));
}

/**
 * Order scenarios so each runs after its dependencies, otherwise keeping file order.
 * Throws on an unknown dependency or a cycle, naming the scenarios involved.
 */
export function orderByDependencies(scenarios: ScenarioSpec[]): ScenarioSpec[] {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const ordered: ScenarioSpec[] = [];
  const state = new Map<string, "visiting" | "done">();

  const visit = (scenario: ScenarioSpec, trail: string[]) => {
    const mark = state.get(scenario.id);
    if (mark === "done") return;
    if (mark === "visiting") {
      const cycle = [...trail.slice(trail.indexOf(scenario.id)), scenario.id];
      throw new Error(`Scenario dependency cycle: ${cycle.join(" → ")}`);
    }
    state.set(scenario.id, "visiting");
    for (const depId of dependenciesOf(scenario)) {
      const dep = byId.get(depId);
      if (!dep) {
        throw new Error(`Scenario "${scenario.id}" depends on "${depId}", which is not in this run`);
      }
      visit(dep, [...trail, scenario.id]);
    }
    state.set(scenario.id, "done");
    ordered.push(scenario);
  };

  for (const scenario of scenarios) visit(scenario, []);
  return ordered;
}

/**
 * The dependency whose saved session a `session: restore` scenario starts from: the one
 * `restoreFrom` names, otherwise the nearest one (direct dependencies first, in declared order, then theirs) that sets
 * `saveSession`.
 */
export function sessionSourceFor(scenario: ScenarioSpec, byId: Map<string, ScenarioSpec>): string | undefined {
  const restored = typeof scenario.restoreFrom === "string" ? scenario.restoreFrom : undefined;
  if (restored) return restored;
  const seen = new Set<string>();
  const queue = dependenciesOf(scenario);
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const dep = byId.get(id);
    if (!dep) continue;
    if (dep.saveSession) return id;
    queue.push(...dependenciesOf(dep));
  }
  return undefined;
}

/**
 * Check the session settings before anything runs, so a misconfigured scenario fails
 * the run up front rather than midway.
 */
export function validateSessions(scenarios: ScenarioSpec[]): void {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  for (const scenario of scenarios) {
    const mode = scenario.session;
    if (mode !== undefined && mode !== "shared" && mode !== "restore" && mode !== "fresh") {
      throw new Error(`Scenario "${scenario.id}" has invalid session "${String(mode)}" (expected shared, restore or fresh)`);
    }
    if (mode === "restore" && !sessionSourceFor(scenario, byId)) {
      throw new Error(
        `Scenario "${scenario.id}" uses session "restore" but none of its dependencies sets saveSession`,
      );
    }
  }
}
