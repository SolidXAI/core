import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { registerMobileSteps } from "../../steps/mobile";
import { FakeClock, FakeDriver, FakeElement } from "./fake-driver";
import { MobileAdapter } from "./mobile-adapter";
import type { MobileAdapterOptions } from "./mobile.types";
import { fingerprintLocators, resolveMobileTarget } from "./resolve-mobile-target";

async function setup(overrides: Partial<MobileAdapterOptions> = {}) {
  const driver = new FakeDriver();
  const mobile = new MobileAdapter({
    appiumUrl: "http://localhost:4723",
    udid: "emulator-5554",
    appSource: "installed",
    appPackage: "com.acme.app",
    appActivity: ".MainActivity",
    recordVideo: false,
    driverFactory: async () => driver,
    clock: new FakeClock(),
    ...overrides,
  });
  await mobile.start();
  const ctx = { scenarioId: "s1", stepPath: "steps[2].when", scenarioType: "mobile", params: {}, mobile } as unknown as TestContext;
  return { driver, mobile, ctx };
}

const save = { by: "accessibilityId", value: "Save" };
const step = (withArgs: Record<string, unknown>, op = "mobile.tap"): OpStep => ({ op, with: withArgs });

describe("resolveMobileTarget", () => {
  it("returns the step's own locator, and records nothing, when it matches", async () => {
    const { driver, mobile, ctx } = await setup();
    driver.add("~Save", new FakeElement());
    const locator = { ...save, extra: "kept" };
    await expect(resolveMobileTarget(ctx, step({ locator, fallbacks: [{ by: "text", value: "Save" }] }))).resolves.toBe(locator);
    expect(mobile.getHeals()).toEqual([]);
  });

  it("does not look anything up for a step without alternatives", async () => {
    const { driver, ctx } = await setup();
    const locator = { ...save };
    await expect(resolveMobileTarget(ctx, step({ locator }))).resolves.toBe(locator);
    expect(driver.callsTo("$$")).toHaveLength(0);
  });

  it("takes the first fallback that matches exactly one displayed element, and reports the heal", async () => {
    const { driver, mobile, ctx } = await setup();
    // Two matches is not unique, a hidden match is not visible, and only the third is both.
    driver.add("~Save changes", new FakeElement(), new FakeElement());
    driver.add("~Hidden save", new FakeElement({ displayed: false }));
    driver.add('android=new UiSelector().text("Save")', new FakeElement());
    const locator = { ...save, index: 0 };
    const healed = await resolveMobileTarget(
      ctx,
      step({
        locator,
        fallbacks: [{ by: "accessibilityId", value: "Save changes" }, { by: "accessibilityId", value: "Hidden save" }, { by: "text", value: "Save" }],
      }),
    );
    expect(healed).toEqual({ by: "text", value: "Save" });
    expect(mobile.getHeals()).toEqual([
      {
        scenarioId: "s1",
        stepPath: "steps[2].when",
        op: "mobile.tap",
        field: "locator",
        from: { by: "accessibilityId", value: "Save", index: 0 },
        to: { by: "text", value: "Save" },
        strategy: "fallback",
        policy: "report",
      },
    ]);
  });

  it("falls back to the fingerprint when no fallback matches", async () => {
    const { driver, mobile, ctx } = await setup();
    driver.add("~Save order", new FakeElement());
    const healed = await resolveMobileTarget(ctx, step({ locator: save, fingerprint: { kind: "Button", accessibilityId: "Save order", label: "Save" } }));
    expect(healed).toEqual({ by: "accessibilityId", value: "Save order" });
    expect(mobile.getHeals()).toMatchObject([{ strategy: "fingerprint", to: { by: "accessibilityId", value: "Save order" } }]);
  });

  it("keeps the other platform's override on the healed locator", async () => {
    const { driver, ctx } = await setup();
    driver.add("~Save order", new FakeElement());
    const ios = { by: "iosPredicate", value: "name == 'Save'" };
    const healed = await resolveMobileTarget(ctx, step({ locator: { ...save, ios }, fallbacks: [{ by: "accessibilityId", value: "Save order" }] }));
    expect(healed).toEqual({ by: "accessibilityId", value: "Save order", ios });
  });

  it("heals the override for the running platform, not the base locator", async () => {
    const android = await setup();
    android.driver.add("~Save order", new FakeElement());
    const locator = { by: "text", value: "Save (base)", android: save };
    const healedAndroid = await resolveMobileTarget(android.ctx, step({ locator, fallbacks: [{ by: "accessibilityId", value: "Save order" }] }));
    expect(healedAndroid).toEqual({ by: "text", value: "Save (base)", android: { by: "accessibilityId", value: "Save order" } });
    expect(android.mobile.getHeals()).toMatchObject([{ field: "locator.android", from: save, to: { by: "accessibilityId", value: "Save order" } }]);

    const ios = await setup({ platformName: "iOS", simulator: true });
    ios.driver.add("~Save order", new FakeElement());
    await resolveMobileTarget(ios.ctx, step({ locator: { by: "text", value: "Save (base)", ios: save }, fallbacks: [{ by: "accessibilityId", value: "Save order" }] }));
    expect(ios.mobile.getHeals()).toMatchObject([{ field: "locator.ios" }]);
  });

  it("uses a fallback's own override for the running platform", async () => {
    const { driver, mobile, ctx } = await setup();
    driver.add("~Android save", new FakeElement());
    const healed = await resolveMobileTarget(
      ctx,
      step({ locator: save, fallbacks: [{ by: "text", value: "Save", android: { by: "accessibilityId", value: "Android save" } }] }),
    );
    expect(healed).toEqual({ by: "accessibilityId", value: "Android save" });
    expect(mobile.getHeals()).toHaveLength(1);
  });

  it("does nothing when healing is off, even with alternatives that would match", async () => {
    const { driver, mobile, ctx } = await setup({ healing: "off" });
    driver.add("~Save order", new FakeElement());
    const locator = { ...save };
    await expect(resolveMobileTarget(ctx, step({ locator, fallbacks: [{ by: "accessibilityId", value: "Save order" }] }))).resolves.toBe(locator);
    expect(mobile.getHeals()).toEqual([]);
    expect(driver.callsTo("$$")).toHaveLength(0);
  });

  it("returns the step's own locator when nothing else is a unique, visible match", async () => {
    const { driver, mobile, ctx } = await setup();
    driver.add("~Save order", new FakeElement(), new FakeElement());
    const locator = { ...save };
    await expect(resolveMobileTarget(ctx, step({ locator, fallbacks: [{ by: "accessibilityId", value: "Save order" }, { by: "uiautomator", value: "x" }] }))).resolves.toBe(locator);
    expect(mobile.getHeals()).toEqual([]);
  });

  it("prefers the step's own locator when it shows up just after the grace period", async () => {
    const { driver, mobile, ctx } = await setup();
    driver.add("~Save order", new FakeElement());
    const late = new FakeElement();
    const lookup = driver.$$.bind(driver);
    let primaryLookups = 0;
    driver.$$ = async (selector: string) => {
      if (selector === "~Save" && (primaryLookups += 1) > 6) driver.elements.set("~Save", [late]);
      return lookup(selector);
    };
    const locator = { ...save };
    await expect(resolveMobileTarget(ctx, step({ locator, fallbacks: [{ by: "accessibilityId", value: "Save order" }] }))).resolves.toBe(locator);
    expect(mobile.getHeals()).toEqual([]);
  });

  it("ignores a locator that is not an object, leaving the step to report it", async () => {
    const { ctx } = await setup();
    await expect(resolveMobileTarget(ctx, step({ locator: "Save", fallbacks: [save] }))).resolves.toBe("Save");
  });
});

describe("fingerprintLocators", () => {
  it("lists the most specific first and skips what the fingerprint lacks", () => {
    expect(fingerprintLocators({ kind: "Button", label: "Save", text: "Save", resourceId: "save_btn", accessibilityId: "save" })).toEqual([
      { by: "accessibilityId", value: "save" },
      { by: "id", value: "save_btn" },
      { by: "text", value: "Save" },
      { by: "description", value: "Save" },
    ]);
    expect(fingerprintLocators({ kind: "Button" })).toEqual([]);
  });
});

describe("healing in the mobile steps", () => {
  async function run(op: string, withArgs: Record<string, unknown>, overrides: Partial<MobileAdapterOptions> = {}) {
    const s = await setup(overrides);
    const registry = new StepRegistry();
    registerMobileSteps(registry);
    return { ...s, run: () => registry.get(op)(s.ctx, { op, with: withArgs }) };
  }

  it("a tap goes to the healed element", async () => {
    const { driver, mobile, run: tap } = await run("mobile.tap", { locator: save, fallbacks: [{ by: "accessibilityId", value: "Save order" }] });
    const [button] = driver.add("~Save order", new FakeElement());
    await tap();
    expect(button.calls).toContain("click");
    expect(mobile.getHeals()).toHaveLength(1);
  });

  it("type, clear, getText, expectVisible and expectText heal too", async () => {
    const fallbacks = [{ by: "accessibilityId", value: "Name field" }];
    const ops: Array<[string, Record<string, unknown>]> = [
      ["mobile.type", { text: "Ann" }],
      ["mobile.clear", {}],
      ["mobile.getText", {}],
      ["mobile.expectVisible", {}],
      ["mobile.expectText", { contains: "" }],
    ];
    for (const [op, extra] of ops) {
      const { driver, mobile, run: go } = await run(op, { locator: { by: "accessibilityId", value: "Name" }, fallbacks, ...extra });
      driver.add("~Name field", new FakeElement());
      await go();
      expect(mobile.getHeals()).toHaveLength(1);
    }
  });

  it("a swipe on an element heals", async () => {
    const { driver, mobile, run: swipe } = await run("mobile.swipe", { direction: "up", locator: save, fallbacks: [{ by: "accessibilityId", value: "Save order" }] });
    driver.add("~Save order", new FakeElement());
    await swipe();
    expect(mobile.getHeals()).toHaveLength(1);
  });

  it("expectHidden never heals: a locator that should match nothing must not be swapped", async () => {
    const { driver, mobile, run: hidden } = await run("mobile.expectHidden", { locator: save, fallbacks: [{ by: "accessibilityId", value: "Save order" }] });
    driver.add("~Save order", new FakeElement());
    await hidden();
    expect(mobile.getHeals()).toEqual([]);
    expect(driver.callsTo("$$").every((call) => call.args[0] === "~Save")).toBe(true);
  });

  it("a step whose alternatives all miss fails with its usual error", async () => {
    const { run: tap } = await run("mobile.tap", { locator: save, timeoutMs: 1000, fallbacks: [{ by: "accessibilityId", value: "Nowhere" }] });
    await expect(tap()).rejects.toThrow('No element matches { by: "accessibilityId", value: "Save" } after 1000 ms');
  });

  it("clears the heals when the next scenario starts", async () => {
    const { driver, mobile, run: tap } = await run("mobile.tap", { locator: save, fallbacks: [{ by: "accessibilityId", value: "Save order" }] });
    driver.add("~Save order", new FakeElement());
    await tap();
    await mobile.resetCapture();
    expect(mobile.getHeals()).toEqual([]);
  });
});
