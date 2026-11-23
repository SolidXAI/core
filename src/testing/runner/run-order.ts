import { randomBytes } from "crypto";
import type { ScenarioSpec } from "../contracts/testing-metadata.types";

/**
 * Orders the selected scenarios for one run. `"file"` keeps the given order. `"shuffle"` shuffles it with a seeded PRNG
 * (the same seed and input always give the same order). In both modes every `dependsOn` target that is in `selected`
 * is then moved ahead of its dependent (a file order that already respects the gates is unchanged), so a gate is
 * always decided before the scenario it gates. Targets outside `selected` are ignored. Never throws and never loops on a dependency cycle (cycles
 * are reported by validation); every selected scenario appears exactly once in `ordered`.
 */
export function orderForRun(
  selected: ScenarioSpec[],
  opts: { order?: "file" | "shuffle"; shuffleSeed?: string },
): { ordered: ScenarioSpec[]; order: "file" | "shuffle"; shuffleSeed?: string } {
  const order = opts.order ?? "file";
  if (order === "file") {
    return { ordered: gatesFirst(selected), order: "file" };
  }

  const shuffleSeed = opts.shuffleSeed ?? randomBytes(4).toString("hex");
  const random = mulberry32(fnv1a32(shuffleSeed));
  const shuffled = [...selected];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return { ordered: gatesFirst(shuffled), order: "shuffle", shuffleSeed };
}

/**
 * Depth-first visit in the given order, in-run `dependsOn` targets first. Ignores targets outside the list and skips a
 * node already being visited (cycle). Tracks scenario objects, not ids, so a duplicate id is never dropped.
 */
function gatesFirst(list: ScenarioSpec[]): ScenarioSpec[] {
  const byId = new Map<string, ScenarioSpec>();
  for (const scenario of list) if (!byId.has(scenario.id)) byId.set(scenario.id, scenario);
  const seen = new Set<ScenarioSpec>();
  const ordered: ScenarioSpec[] = [];
  const visit = (scenario: ScenarioSpec) => {
    if (seen.has(scenario)) return;
    seen.add(scenario);
    for (const depId of dependenciesOf(scenario)) {
      const dep = byId.get(depId);
      if (dep) visit(dep);
    }
    ordered.push(scenario);
  };
  for (const scenario of list) visit(scenario);
  return ordered;
}

function dependenciesOf(scenario: ScenarioSpec): string[] {
  return Array.isArray(scenario.dependsOn) ? scenario.dependsOn.map(String) : [];
}

/** 32-bit FNV-1a hash of a string. */
function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small seeded PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
