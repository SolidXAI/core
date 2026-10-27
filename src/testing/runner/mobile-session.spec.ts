import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { NO_RESET_SCENARIO, planMobileSetup, splitResetScenario } from "./mobile-session";

const scenario = (id: string, over: Partial<ScenarioSpec> = {}): ScenarioSpec => ({
  id,
  type: "mobile",
  steps: [{ given: { op: "mobile.launch" } }, { when: { op: "mobile.tap", with: { locator: { by: "accessibilityId", value: id } } } }],
  ...over,
});

describe("splitResetScenario", () => {
  it("leaves a file without a reset scenario alone", () => {
    const all = [scenario("a"), scenario("b")];
    expect(splitResetScenario(all)).toEqual({ rest: all });
  });

  it("takes the reset scenario out, so it is never run or counted on its own", () => {
    const reset = scenario("reset", { reset: true });
    const a = scenario("a");
    expect(splitResetScenario([a, reset])).toEqual({ reset, rest: [a] });
  });

  it("refuses two reset scenarios, naming both", () => {
    expect(() => splitResetScenario([scenario("r1", { reset: true }), scenario("r2", { reset: true })])).toThrow('found "r1", "r2"');
  });

  it("refuses a reset scenario that depends on, saves or restores a session", () => {
    for (const over of [{ dependsOn: ["x"] }, { saveSession: true }, { session: "restore" as const }, { session: "fresh" as const }]) {
      expect(() => splitResetScenario([scenario("reset", { reset: true, ...over })])).toThrow("has to work from any state");
    }
    expect(() => splitResetScenario([scenario("reset", { reset: true, session: "shared" })])).not.toThrow();
  });

  it("refuses a scenario that depends on the reset scenario", () => {
    expect(() => splitResetScenario([scenario("reset", { reset: true }), scenario("a", { dependsOn: ["reset"] })])).toThrow(
      'Scenario "a" depends on the reset scenario "reset"',
    );
  });
});

describe("planMobileSetup", () => {
  const reset = scenario("reset", { reset: true });
  const login = scenario("login", { saveSession: true });
  const cart = scenario("cart", { dependsOn: ["login"], session: "restore", saveSession: true });
  const checkout = scenario("checkout", { dependsOn: ["cart"], session: "restore" });
  const byId = new Map([login, cart, checkout].map((s) => [s.id, s]));
  const secretsOf = (id: string) => ({ owner: id });
  const plan = (target: ScenarioSpec, over: { phone?: boolean; reset?: ScenarioSpec; loggedInBy?: string } = {}) =>
    planMobileSetup({
      scenario: target,
      phone: over.phone ?? false,
      byId,
      reset: "reset" in over ? over.reset : reset,
      state: { loggedInBy: over.loggedInBy },
      secretsOf,
    });
  const summary = (parts: ReturnType<typeof plan>) => parts.map((p) => `${p.kind}:${p.scenario.id}:${p.scenario.steps.length}`);
  const launchOf = (parts: ReturnType<typeof plan>, index: number) => (parts[index].scenario.steps[0] as any).given.with;

  it("does nothing for a shared scenario, which carries on in the app as it was left", () => {
    expect(plan(scenario("a"))).toEqual([]);
    expect(plan(scenario("a", { session: "shared" }))).toEqual([]);
    expect(plan(login, { phone: true })).toEqual([]);
  });

  it("fresh on a device that can clear data is a launch with the data cleared", () => {
    const parts = plan(scenario("a", { session: "fresh" }));
    expect(summary(parts)).toEqual(["reset:a:1"]);
    expect(launchOf(parts, 0)).toEqual({ clearData: true });
  });

  it("fresh on an iPhone relaunches, then runs the reset scenario, and never clears data", () => {
    const parts = plan(scenario("a", { session: "fresh" }), { phone: true });
    expect(summary(parts)).toEqual(["reset:a:1", "reset:reset:2"]);
    expect(launchOf(parts, 0)).toEqual({});
    expect(parts[1].scenario).toBe(reset);
  });

  it("fresh on an iPhone with no reset scenario fails with the message that says what to add", () => {
    expect(() => plan(scenario("a", { session: "fresh" }), { phone: true, reset: undefined })).toThrow(NO_RESET_SCENARIO);
  });

  it("restore right after its producer only relaunches the app", () => {
    expect(summary(plan(cart, { loggedInBy: "login" }))).toEqual(["restore:cart:1"]);
    expect(launchOf(plan(cart, { loggedInBy: "login" }), 0)).toEqual({});
  });

  it("restore from a cold start clears the app, then runs the producer again with its secrets", () => {
    const parts = plan(cart);
    expect(summary(parts)).toEqual(["reset:cart:1", "restore:login:2"]);
    expect(launchOf(parts, 0)).toEqual({ clearData: true });
    expect(parts[1].secrets).toEqual({ owner: "login" });
  });

  it("restore from a cold start on an iPhone resets through the reset scenario, then logs in again", () => {
    expect(summary(plan(cart, { phone: true }))).toEqual(["reset:cart:1", "reset:reset:2", "restore:login:2"]);
  });

  it("restore rebuilds the whole chain when the producer was itself restored", () => {
    expect(summary(plan(checkout))).toEqual(["reset:checkout:1", "restore:login:2", "restore:cart:2"]);
  });

  it("restore after a different scenario touched the app is a cold start", () => {
    expect(summary(plan(cart, { loggedInBy: "something-else" }))).toEqual(["reset:cart:1", "restore:login:2"]);
  });
});
