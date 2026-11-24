// Purpose: only scenario contexts are filmed. Setups, ready checks and teardowns open unrecorded contexts, so their
// steps stay out of the joined run video.

import type { ScenarioSpec, SetupSpec } from "../contracts/testing-metadata.types";
import { RecordingReporter } from "./recording-reporter";
import { runFromMetadata } from "./run-from-metadata";

const mockCtor = jest.fn();
const mockCalls: Array<{ method: string; arg?: any }> = [];

jest.mock("../adapters/ui/browser-provisioner", () => ({
  ensureChromiumInstalled: jest.fn(async () => undefined),
  isChromiumInstalled: jest.fn(async () => true),
}));

// A stand-in adapter: every method records its call and resolves to something empty, so no browser is needed.
jest.mock("../adapters/ui/playwright-adapter", () => ({
  PlaywrightAdapter: class {
    constructor(opts: unknown) {
      mockCtor(opts);
      return new Proxy(this, {
        get: (target: any, prop: string) => {
          if (prop in target) return target[prop];
          if (prop === "then") return undefined;
          if (prop === "page") return { goto: async () => undefined };
          if (prop === "resolveUrl") return (url: string) => url;
          if (prop === "storageState") return async () => ({ cookies: [], origins: [] });
          if (prop === "captureSessionStorage") return async () => ({});
          if (prop === "getHeals" || prop === "getRunVideos" || prop === "collectFailureArtifacts") return () => [];
          if (prop === "resolveTimeout" || prop === "resolveNavigationTimeout") return () => 1000;
          return (arg?: unknown) => {
            mockCalls.push({ method: prop, arg });
            return undefined;
          };
        },
      });
    }
  },
}));

const uiSetup = (id: string, extra: Partial<SetupSpec> = {}): SetupSpec => ({
  id,
  name: id,
  type: "ui",
  steps: [{ op: "assert.equals", with: { actual: 1, expected: 1 } }],
  ...extra,
});
const uiScenario = (id: string, extra: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id,
  type: "ui",
  steps: [{ op: "ui.goto", with: { url: "/" } }],
  ...extra,
});

const contexts = () => mockCalls.filter((c) => c.method === "newContext").map((c) => c.arg ?? {});

beforeEach(() => {
  mockCtor.mockClear();
  mockCalls.length = 0;
});

describe("runIndependent: which contexts are filmed", () => {
  it("builds the adapter without filming its first context", async () => {
    await runFromMetadata({ scenarios: [uiScenario("a")], reporter: new RecordingReporter(), failFast: false });
    expect(mockCtor).toHaveBeenCalledWith(expect.objectContaining({ recordInitialContext: false }));
  });

  it("films a scenario that has no setup", async () => {
    await runFromMetadata({ scenarios: [uiScenario("a")], reporter: new RecordingReporter(), failFast: false });
    expect(contexts()).toHaveLength(1);
    expect(contexts()[0].record).not.toBe(false);
  });

  it("does not film a setup's context, and films the scenario that restores it", async () => {
    await runFromMetadata({
      scenarios: [uiScenario("a", { restoreFrom: "login" })],
      setups: [uiSetup("login", { ready: [{ op: "ui.goto", with: { url: "/" } }] })],
      reporter: new RecordingReporter(),
      failFast: false,
    });
    const all = contexts();
    expect(all[0].record).toBe(false);
    expect(all[all.length - 1].record).not.toBe(false);
  });

  it("runs a ready check off camera, then opens a filmed context for the scenario", async () => {
    await runFromMetadata({
      scenarios: [uiScenario("a", { restoreFrom: "login" })],
      setups: [uiSetup("login", { ready: [{ op: "ui.goto", with: { url: "/" } }] })],
      reporter: new RecordingReporter(),
      failFast: false,
    });
    const all = contexts();
    // setup (unrecorded), seeded context for the ready check (unrecorded), seeded context for the scenario (recorded)
    expect(all.map((c) => c.record)).toEqual([false, false, undefined]);
  });
});
