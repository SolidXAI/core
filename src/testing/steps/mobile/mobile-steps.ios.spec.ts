import { FakeClock, FakeDriver, FakeElement } from "../../adapters/mobile/fake-driver";
import { MobileAdapter } from "../../adapters/mobile/mobile-adapter";
import type { TestContext } from "../../contracts/runtime-context.types";
import { StepRegistry } from "../../core/step-registry";
import { registerMobileSteps } from "./index";

const NAV_BUTTONS = "-ios class chain:**/XCUIElementTypeNavigationBar/XCUIElementTypeButton";

async function setup(phone = false, clock?: FakeClock) {
  const driver = new FakeDriver();
  const runCommand = jest.fn(async () => undefined);
  const mobile = new MobileAdapter({
    appiumUrl: "http://localhost:4723",
    udid: phone ? "00008140-001A202611B8801C" : "1674E718-0EBA-4568-9644-F18E0DDF7705",
    platformName: "iOS",
    simulator: !phone,
    appSource: phone ? "installed" : "upload",
    appPath: phone ? undefined : "/builds/Sample.app",
    appPackage: phone ? "com.oswald.mydemoapp" : "io.solidx.testhub.sample",
    recordVideo: false,
    driverFactory: async () => driver,
    runCommand,
    clock,
  });
  await mobile.start();
  const registry = new StepRegistry();
  registerMobileSteps(registry);
  const ctx = { scenarioId: "s1", scenarioType: "mobile", params: {}, mobile } as unknown as TestContext;
  const run = (op: string, withArgs?: Record<string, unknown>) => registry.get(op)(ctx, { op, with: withArgs });
  return { driver, mobile, run, runCommand };
}
const executes = (driver: FakeDriver) => driver.callsTo("execute").map((call) => call.args);

describe("mobile steps on iOS", () => {
  describe("mobile.swipe", () => {
    it("drags across the screen with the same margins as Android", async () => {
      const { run, driver } = await setup();
      driver.windowSize = { width: 400, height: 800 };
      await run("mobile.swipe", { direction: "up" });
      // Area: 10% margins -> left 40, top 80, 320 x 640; centre (200, 400); 0.75 * 640 / 2 = 240.
      expect(executes(driver)).toEqual([
        ["mobile: dragFromToForDuration", { fromX: 200, fromY: 640, toX: 200, toY: 160, duration: 0.25 }],
      ]);
    });

    it("drags inside an element's area", async () => {
      const { run, driver } = await setup();
      driver.add("~List", new FakeElement({ location: { x: 0, y: 100 }, size: { width: 200, height: 400 } }));
      await run("mobile.swipe", { direction: "left", percent: 0.5, locator: { by: "accessibilityId", value: "List" } });
      expect(executes(driver)).toEqual([
        ["mobile: dragFromToForDuration", { fromX: 150, fromY: 300, toX: 50, toY: 300, duration: 0.25 }],
      ]);
    });
  });

  describe("mobile.scrollTo", () => {
    it("swipes with the iOS gesture until the element shows", async () => {
      const { run, driver } = await setup();
      const target = new FakeElement({ displayed: false });
      driver.add("~Footer", target);
      driver.execute = (async (script: string) => {
        if (script === "mobile: dragFromToForDuration") target.displayed = true;
        return undefined;
      }) as never;
      await run("mobile.scrollTo", { locator: { by: "accessibilityId", value: "Footer" } });
      expect(target.displayed).toBe(true);
    });
  });

  describe("mobile.back", () => {
    it("taps back when the navigation bar has a button", async () => {
      const { run, driver } = await setup();
      driver.add(NAV_BUTTONS, new FakeElement());
      await run("mobile.back");
      expect(driver.callsTo("back")).toHaveLength(1);
    });

    it("fails clearly when there is no back button, instead of doing nothing", async () => {
      const { run, driver } = await setup();
      await expect(run("mobile.back")).rejects.toThrow(
        "mobile.back: this screen has no back button on iOS. Tap the screen's own back control instead.",
      );
      expect(driver.callsTo("back")).toHaveLength(0);
    });
  });

  describe("mobile.hideKeyboard", () => {
    it("hides the keyboard without asking whether it is shown", async () => {
      const { run, driver } = await setup();
      await run("mobile.hideKeyboard");
      expect(driver.callsTo("isKeyboardShown")).toHaveLength(0);
      expect(driver.callsTo("hideKeyboard")).toHaveLength(1);
    });

    it("treats 'nothing to dismiss' as done", async () => {
      const { run, driver } = await setup();
      driver.failing.add("hideKeyboard");
      driver.failureMessages.set("hideKeyboard", "Did not know how to dismiss the keyboard. Try to dismiss it in the way supported by your application under test.");
      await expect(run("mobile.hideKeyboard")).resolves.toBeUndefined();
    });

    it("still fails on any other error", async () => {
      const { run, driver } = await setup();
      driver.failing.add("hideKeyboard");
      await expect(run("mobile.hideKeyboard")).rejects.toThrow("hideKeyboard failed");
    });
  });

  describe("mobile.launch", () => {
    it("passes grantPermissions through", async () => {
      const { run, runCommand } = await setup();
      await run("mobile.launch", { clearData: true, grantPermissions: false });
      expect(runCommand).not.toHaveBeenCalled();
      await run("mobile.launch", { clearData: true });
      expect(runCommand).toHaveBeenCalledTimes(1);
    });

    it("rejects a grantPermissions that is not a boolean", async () => {
      const { run } = await setup();
      await expect(run("mobile.launch", { grantPermissions: "no" })).rejects.toThrow();
    });

    it("mobile.reset reinstalls the build", async () => {
      const { run, driver } = await setup();
      await run("mobile.reset");
      expect(executes(driver).map((a) => a[0])).toContain("mobile: installApp");
    });
  });
});

const DONE_KEY = '-ios class chain:**/XCUIElementTypeKeyboard/**/XCUIElementTypeButton[`name IN {"Done","done","Hide keyboard","Dismiss"}`]';
const KEYBOARD = { x: 0, y: 500, width: 400, height: 300 };
/** A screen with a back button at the top left, and a Login button just above the keyboard. */
const SCREEN = `<XCUIElementTypeApplication x="0" y="0" width="400" height="800">
  <XCUIElementTypeButton name="Back" x="0" y="50" width="400" height="40"/>
  <XCUIElementTypeTextField name="User" x="20" y="200" width="360" height="40"/>
  <XCUIElementTypeButton name="Login" x="20" y="440" width="360" height="60"/>
</XCUIElementTypeApplication>`;

async function withKeyboard(hideWith?: Array<"driver" | "tapOutside" | "swipeDown">) {
  const made = await setup(true, new FakeClock());
  made.driver.keyboardShown = true;
  made.driver.keyboardRect = KEYBOARD;
  made.driver.windowSize = { width: 400, height: 800 };
  made.driver.pageSource = SCREEN;
  if (hideWith) made.driver.hideWith = new Set(hideWith);
  return made;
}
const dismissFails = (driver: FakeDriver) => {
  driver.failing.add("hideKeyboard");
  driver.failureMessages.set("hideKeyboard", "Did not know how to dismiss the keyboard. Try to dismiss it in the way supported by your application under test.");
};

describe("mobile.hideKeyboard on a real iPhone (D47)", () => {
  const NOT_HIDDEN = "mobile.hideKeyboard: the keyboard could not be hidden on this screen. It stayed up after the keyboard's Done key, a tap outside the fields and a swipe down, so this screen only ends editing on a control of its own.";

  it("uses the driver's own hide first, and says so", async () => {
    const { run, driver } = await withKeyboard();
    await expect(run("mobile.hideKeyboard")).resolves.toEqual({ method: "driver" });
    expect(driver.callsTo("hideKeyboard")).toHaveLength(1);
    expect(executes(driver)).toEqual([]);
  });

  it("falls back to the keyboard's Done key", async () => {
    const { run, driver } = await withKeyboard(["tapOutside"]);
    dismissFails(driver);
    const done = new FakeElement();
    done.click = async () => { driver.keyboardShown = false; };
    driver.add(DONE_KEY, done);
    await expect(run("mobile.hideKeyboard")).resolves.toEqual({ method: "doneKey" });
  });

  it("then to a tap outside the fields, on a point that is on no control", async () => {
    const { run, driver } = await withKeyboard(["tapOutside"]);
    dismissFails(driver);
    await expect(run("mobile.hideKeyboard")).resolves.toEqual({ method: "tapOutside" });
    const [script, args] = executes(driver)[0] as [string, { x: number; y: number }];
    expect(script).toBe("mobile: tap");
    // Above the keyboard (y < 500), and clear of the Back button (y 50-90) and the field (y 200-240), which span the width.
    expect(args.y).toBeLessThan(KEYBOARD.y);
    expect(args.y < 50 || (args.y > 90 && args.y < 200) || (args.y > 240 && args.y < 440)).toBe(true);
  });

  it("then to a swipe down from the top of the keyboard", async () => {
    const { run, driver } = await withKeyboard(["swipeDown"]);
    dismissFails(driver);
    await expect(run("mobile.hideKeyboard")).resolves.toEqual({ method: "swipeDown" });
    // The tap outside was tried first and did nothing; the drag is the last gesture.
    const [script, args] = executes(driver).at(-1) as [string, Record<string, number>];
    expect(script).toBe("mobile: dragFromToForDuration");
    expect(args.fromY).toBe(KEYBOARD.y - 16);
    expect(args.toY).toBeGreaterThan(KEYBOARD.y);
  });

  it("fails when nothing hides it", async () => {
    const { run, driver } = await withKeyboard([]);
    dismissFails(driver);
    await expect(run("mobile.hideKeyboard")).rejects.toThrow(NOT_HIDDEN);
  });

  it("tries the recorded method first, without the driver's call", async () => {
    const { run, driver } = await withKeyboard(["tapOutside"]);
    await expect(run("mobile.hideKeyboard", { method: "tapOutside" })).resolves.toEqual({ method: "tapOutside" });
    expect(driver.callsTo("hideKeyboard")).toHaveLength(0);
  });

  it("still passes when the recorded method no longer works but another does", async () => {
    const { run } = await withKeyboard(["driver"]);
    await expect(run("mobile.hideKeyboard", { method: "swipeDown" })).resolves.toEqual({ method: "driver" });
  });

  it("refuses a method it does not know", async () => {
    const { run } = await withKeyboard();
    await expect(run("mobile.hideKeyboard", { method: "bogus" })).rejects.toThrow(
      '"method" must be one of driver, doneKey, tapOutside, swipeDown for op "mobile.hideKeyboard"',
    );
  });

  it("does nothing when there is no keyboard", async () => {
    const { run, driver } = await setup(true);
    driver.keyboardShown = false;
    dismissFails(driver);
    await expect(run("mobile.hideKeyboard")).resolves.toEqual({ method: "none" });
    expect(driver.callsTo("hideKeyboard")).toHaveLength(0);
  });

  it("still fails on any other error", async () => {
    const { run, driver } = await setup(true, new FakeClock());
    driver.keyboardShown = true;
    driver.failing.add("hideKeyboard");
    await expect(run("mobile.hideKeyboard")).rejects.toThrow("hideKeyboard failed");
  });

  it("the Simulator is unchanged: it never asks whether the keyboard is shown", async () => {
    const { run, driver } = await setup(false);
    driver.keyboardShown = true;
    dismissFails(driver);
    await expect(run("mobile.hideKeyboard")).resolves.toBeUndefined();
    expect(driver.callsTo("isKeyboardShown")).toHaveLength(0);
  });
});
