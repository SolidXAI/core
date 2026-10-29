import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import type { ScenarioSetup } from "../core/testing-engine";
import { normalizeBlock } from "../core/normalize-steps";
import { sessionSourceFor } from "./scenario-graph";

/**
 * How long a restore looks for the screen its source scenario ended on, after relaunching the app. Long enough for the app to
 * draw its first screen; a lookup that stalls counts as "not there", which only costs a replay of the login.
 */
export const RESTORE_PROBE_MS = 5000;

export const NO_RESET_SCENARIO =
  'This iPhone application has no reset scenario. Add a scenario with "reset": true that brings the app to its signed-out start screen from any state.';

/** What the app was last left in by a scenario of this run. */
export interface MobileSessionState {
  /** The scenario that passed with `saveSession` and left the app logged in, until another scenario touches the app. */
  loggedInBy?: string;
  /**
   * The restore source whose state the app was last brought to in this run. Only a hint, because scenarios in between may have
   * changed the app: it is checked on the device before it is trusted.
   */
  mayBeIn?: string;
}

/** The locator of a scenario's last `mobile.expectVisible`, which is the screen it leaves the app on. Undefined when it has none. */
export function probeFor(source: ScenarioSpec | undefined): { locator: unknown } | undefined {
  let locator: unknown;
  for (const block of source?.steps ?? []) {
    for (const step of normalizeBlock(block).steps) {
      if (step.op === "mobile.expectVisible" && step.with?.locator !== undefined) locator = step.with.locator;
    }
  }
  // A locator with a ${...} token needs the scenario's own values to resolve, which a probe does not have.
  if (locator === undefined || JSON.stringify(locator).includes("${")) return undefined;
  return { locator };
}

/**
 * Takes the reset scenario out of a file's scenarios. It never runs, or counts, as a scenario of its own: it is setup that the
 * runner runs before a scenario that needs a fresh start. Throws when the file's reset scenarios cannot work as setup.
 */
export function splitResetScenario(all: ScenarioSpec[]): { reset?: ScenarioSpec; rest: ScenarioSpec[] } {
  const resets = all.filter((s) => s.reset === true);
  if (resets.length === 0) return { rest: all };
  if (resets.length > 1) {
    throw new Error(`Only one scenario can set "reset": true, found ${resets.map((s) => `"${s.id}"`).join(", ")}`);
  }
  const reset = resets[0];
  if (reset.dependsOn?.length || reset.saveSession || (reset.session && reset.session !== "shared")) {
    throw new Error(`Reset scenario "${reset.id}" cannot use dependsOn, saveSession or session: it has to work from any state`);
  }
  const dependent = all.find((s) => s !== reset && (s.dependsOn ?? []).map(String).includes(reset.id));
  if (dependent) {
    throw new Error(`Scenario "${dependent.id}" depends on the reset scenario "${reset.id}", which only runs as setup`);
  }
  return { reset, rest: all.filter((s) => s !== reset) };
}

/** The scenarios whose steps rebuild the state that `source` saved, oldest first: a restore scenario saved on top of its own. */
function restoreChain(id: string, byId: Map<string, ScenarioSpec>): ScenarioSpec[] {
  const scenario = byId.get(id)!;
  if (scenario.session === "restore") {
    const previous = sessionSourceFor(scenario, byId);
    if (previous) return [...restoreChain(previous, byId), scenario];
  }
  return [scenario];
}

/** One step of the app's own start, as setup: the same `mobile.launch` a scenario would begin with. */
function launchPart(scenario: ScenarioSpec, kind: "reset" | "restore", clearData: boolean): ScenarioSetup {
  return {
    kind,
    scenario: {
      id: scenario.id,
      type: "mobile",
      steps: [
        {
          given: {
            op: "mobile.launch",
            name: clearData ? "Start the app with its data cleared" : "Start the app again",
            with: clearData ? { clearData: true } : {},
          },
        },
      ],
    },
  };
}

/**
 * What to run before a mobile scenario, from its `session`:
 * - `shared` (the default): nothing; the scenario carries on in the app as the last one left it.
 * - `fresh`: the app from scratch. On a device that can clear an app's data, that is a launch with the data cleared. A real
 *   iPhone cannot, so the file's reset scenario brings the app back to its start screen instead.
 * - `restore`: the app logged in as the scenario it depends on left it. When that scenario has just passed and nothing has
 *   touched the app since, a relaunch is enough; otherwise the app starts from scratch and that scenario's steps run again.
 * Throws when a real iPhone is asked for a fresh start and the file has no reset scenario.
 */
export function planMobileSetup(args: {
  scenario: ScenarioSpec;
  phone: boolean;
  byId: Map<string, ScenarioSpec>;
  reset?: ScenarioSpec;
  state: MobileSessionState;
  secretsOf: (scenarioId: string) => Record<string, any> | undefined;
}): ScenarioSetup[] {
  const { scenario, phone, byId, reset, state, secretsOf } = args;
  const mode = scenario.session ?? "shared";
  if (mode === "shared") return [];

  const source = mode === "restore" ? sessionSourceFor(scenario, byId) : undefined;
  if (source && state.loggedInBy === source) return [launchPart(scenario, "restore", false)];

  const parts: ScenarioSetup[] = [];
  if (phone) {
    if (!reset) throw new Error(NO_RESET_SCENARIO);
    // The reset starts from the app in front, even if the reset scenario forgot to launch it.
    parts.push(launchPart(scenario, "reset", false));
    parts.push({ kind: "reset", scenario: reset, secrets: secretsOf(reset.id) });
  } else {
    parts.push(launchPart(scenario, "reset", true));
  }
  if (source) {
    for (const dependency of restoreChain(source, byId)) {
      parts.push({ kind: "restore", scenario: dependency, secrets: secretsOf(dependency.id) });
    }
    // The app was last brought to the source's state, so it may still be there: relaunch it and look for the screen the source
    // ends on. Found, the steps above are not needed; not found, they run as they always did.
    const probe = state.mayBeIn === source ? probeFor(byId.get(source)) : undefined;
    if (probe) {
      return [{ ...launchPart(scenario, "restore", false), probe: { ...probe, timeoutMs: RESTORE_PROBE_MS }, orElse: parts }];
    }
  }
  return parts;
}
