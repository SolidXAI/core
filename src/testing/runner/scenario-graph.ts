import type { ScenarioSpec } from "../contracts/testing-metadata.types";

export function usesDependencies(scenarios: ScenarioSpec[]): boolean {
  return scenarios.some(
    (s) => (Array.isArray(s.dependsOn) && s.dependsOn.length > 0) || s.saveSession || (s.session && s.session !== "shared"),
  );
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
 * The dependency whose saved session a `session: restore` scenario starts from: the
 * nearest one (direct dependencies first, in declared order, then theirs) that sets
 * `saveSession`.
 */
export function sessionSourceFor(scenario: ScenarioSpec, byId: Map<string, ScenarioSpec>): string | undefined {
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
