import { FakeDriver, FakeElement } from "../../adapters/mobile/fake-driver";
import { MobileAdapter } from "../../adapters/mobile/mobile-adapter";
import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { registerMobileSteps } from "./index";

const ALL_OPS = [
  "mobile.launch",
  "mobile.reset",
  "mobile.terminate",
  "mobile.tap",
  "mobile.type",
  "mobile.clear",
  "mobile.swipe",
  "mobile.scrollTo",
  "mobile.back",
  "mobile.hideKeyboard",
  "mobile.expectVisible",
  "mobile.expectHidden",
  "mobile.expectText",
  "mobile.getText",
];

const save = { by: "accessibilityId", value: "Save" };

async function setup(started = true) {
  const driver = new FakeDriver();
  const mobile = new MobileAdapter({
    appiumUrl: "http://localhost:4723",
    udid: "emulator-5554",
    appSource: "installed",
    appPackage: "com.acme.app",
    appActivity: ".MainActivity",
    recordVideo: false,
    driverFactory: async () => driver,
  });
  if (started) await mobile.start();
  const registry = new StepRegistry();
  registerMobileSteps(registry);
  const ctx = { scenarioId: "s1", scenarioType: "mobile", params: {}, mobile } as unknown as TestContext;
  const run = (op: string, withArgs?: Record<string, unknown>, extra: Partial<OpStep> = {}) =>
    registry.get(op)(ctx, { op, with: withArgs, ...extra });
  return { driver, mobile, registry, ctx, run };
}

const executes = (driver: FakeDriver) => driver.callsTo("execute").map((call) => call.args);

describe("mobile steps", () => {
  it("registers every op", async () => {
    const { registry } = await setup();
    for (const op of ALL_OPS) expect(registry.has(op)).toBe(true);
  });

  it("every op needs a started mobile session", async () => {
    const { run } = await setup(false);
    for (const op of ALL_OPS) {
      await expect(run(op, { locator: save, text: "x", equals: "x", direction: "up" })).rejects.toThrow(
        `Missing mobile session on context for op "${op}"`,
      );
    }
  });

  describe("app steps", () => {
    it("launch restarts the app without clearing data", async () => {
      const { run, driver } = await setup();
      await run("mobile.launch");
      expect(executes(driver).map((args) => args[0])).toEqual([
        "mobile: terminateApp",
        "mobile: activateApp",
        "mobile: queryAppState",
      ]);
    });

    it("launch with clearData wipes the app's data", async () => {
      const { run, driver } = await setup();
      await run("mobile.launch", { clearData: true });
      expect(executes(driver).map((args) => args[0])).toContain("mobile: clearApp");
    });

    it("launch rejects a clearData that is not a boolean", async () => {
      const { run } = await setup();
      await expect(run("mobile.launch", { clearData: "yes" })).rejects.toThrow(
        '"clearData" must be true or false for op "mobile.launch"',
      );
    });

    it("reset always clears data", async () => {
      const { run, driver } = await setup();
      await run("mobile.reset");
      expect(executes(driver).map((args) => args[0])).toContain("mobile: clearApp");
    });

    it("terminate stops the app", async () => {
      const { run, driver } = await setup();
      await run("mobile.terminate");
      expect(executes(driver)).toEqual([["mobile: terminateApp", { appId: "com.acme.app" }]]);
    });
  });

  describe("tap, type and clear", () => {
    it("tap waits for the element and clicks it", async () => {
      const { run, driver } = await setup();
      const [button] = driver.add("~Save", new FakeElement());
      await run("mobile.tap", { locator: save });
      expect(button.calls.some((call) => call.startsWith("waitForDisplayed"))).toBe(true);
      expect(button.calls).toContain("click");
    });

    it("tap needs a locator", async () => {
      const { run } = await setup();
      await expect(run("mobile.tap", {})).rejects.toThrow('Missing "locator" in step.with for op "mobile.tap"');
    });

    it("tap fails on an ambiguous locator", async () => {
      const { run, driver } = await setup();
      driver.add("~Save", new FakeElement(), new FakeElement());
      await expect(run("mobile.tap", { locator: save })).rejects.toThrow("matched 2 elements");
    });

    it("tap taps the match at index", async () => {
      const { run, driver } = await setup();
      const [, second] = driver.add("~Save", new FakeElement(), new FakeElement());
      await run("mobile.tap", { locator: { ...save, index: 1 } });
      expect(second.calls).toContain("click");
    });

    it("uses the step's timeout, from with.timeoutMs or step.timeoutMs", async () => {
      const { run } = await setup();
      await expect(run("mobile.tap", { locator: save, timeoutMs: 3000 })).rejects.toThrow("after 3000 ms");
      await expect(run("mobile.tap", { locator: save }, { timeoutMs: 4000 })).rejects.toThrow("after 4000 ms");
    });

    it("type replaces the text by default", async () => {
      const { run, driver } = await setup();
      const [field] = driver.add("~Name", new FakeElement({ text: "old" }));
      await run("mobile.type", { locator: { by: "accessibilityId", value: "Name" }, text: "bob" });
      expect(field.calls).toContain("setValue:bob");
      expect(field.text).toBe("bob");
    });

    it("type appends with clear: false, and accepts a number", async () => {
      const { run, driver } = await setup();
      const [field] = driver.add("~Pin", new FakeElement({ text: "12" }));
      await run("mobile.type", { locator: { by: "accessibilityId", value: "Pin" }, text: 34, clear: false });
      expect(field.text).toBe("1234");
    });

    it("type needs text", async () => {
      const { run } = await setup();
      await expect(run("mobile.type", { locator: save })).rejects.toThrow('Missing "text" in step.with for op "mobile.type"');
    });

    it("type rejects a clear that is not a boolean", async () => {
      const { run } = await setup();
      await expect(run("mobile.type", { locator: save, text: "x", clear: "no" })).rejects.toThrow(
        '"clear" must be true or false for op "mobile.type"',
      );
    });

    it("clear empties the field", async () => {
      const { run, driver } = await setup();
      const [field] = driver.add("~Name", new FakeElement({ text: "bob" }));
      await run("mobile.clear", { locator: { by: "accessibilityId", value: "Name" } });
      expect(field.text).toBe("");
    });
  });

  describe("back and hideKeyboard", () => {
    it("back presses back", async () => {
      const { run, driver } = await setup();
      await run("mobile.back");
      expect(driver.callsTo("back")).toHaveLength(1);
    });

    it("hideKeyboard hides it only when it is shown", async () => {
      const { run, driver } = await setup();
      await run("mobile.hideKeyboard");
      expect(driver.callsTo("hideKeyboard")).toHaveLength(0);
      driver.keyboardShown = true;
      await run("mobile.hideKeyboard");
      expect(driver.callsTo("hideKeyboard")).toHaveLength(1);
    });
  });

  describe("swipe", () => {
    it("swipes across the screen, clear of the system bars, when there is no locator", async () => {
      const { run, driver } = await setup();
      await run("mobile.swipe", { direction: "up" });
      expect(executes(driver)[0]).toEqual([
        "mobile: swipeGesture",
        { left: 108, top: 240, width: 864, height: 1920, direction: "up", percent: 0.75 },
      ]);
    });

    it("swipes inside an element when it has a locator, with a custom percent", async () => {
      const { run, driver } = await setup();
      driver.add("~List", new FakeElement({ location: { x: 10, y: 20 }, size: { width: 500, height: 800 } }));
      await run("mobile.swipe", { direction: "left", percent: 0.5, locator: { by: "accessibilityId", value: "List" } });
      expect(executes(driver)[0]).toEqual([
        "mobile: swipeGesture",
        { left: 10, top: 20, width: 500, height: 800, direction: "left", percent: 0.5 },
      ]);
    });

    it.each([[undefined], ["sideways"], [3]])("rejects direction %p", async (direction) => {
      const { run } = await setup();
      await expect(run("mobile.swipe", { direction })).rejects.toThrow(
        '"direction" must be one of up, down, left, right for op "mobile.swipe"',
      );
    });

    it.each([[0], [1.5], ["half"]])("rejects percent %p", async (percent) => {
      const { run } = await setup();
      await expect(run("mobile.swipe", { direction: "up", percent })).rejects.toThrow(
        '"percent" must be a number from 0.1 to 1 for op "mobile.swipe"',
      );
    });
  });

  describe("scrollTo", () => {
    const target = { by: "accessibilityId", value: "Target" };

    it("does not swipe when the element is already on screen", async () => {
      const { run, driver } = await setup();
      driver.add("~Target", new FakeElement());
      await run("mobile.scrollTo", { locator: target });
      expect(executes(driver)).toHaveLength(0);
    });

    it("swipes up to scroll down until the element appears", async () => {
      const { run, driver } = await setup();
      const original = driver.execute.bind(driver);
      let swipes = 0;
      driver.execute = async (script: string, ...args: unknown[]) => {
        if (script === "mobile: swipeGesture") {
          swipes += 1;
          if (swipes === 2) driver.add("~Target", new FakeElement());
        }
        return original(script, ...args);
      };
      await run("mobile.scrollTo", { locator: target });
      expect(swipes).toBe(2);
      const swipeArgs = driver.callsTo("execute").filter((c) => c.args[0] === "mobile: swipeGesture");
      expect((swipeArgs[0].args[1] as any).direction).toBe("up");
    });

    it("scrolls up by swiping down", async () => {
      const { run, driver } = await setup();
      await expect(run("mobile.scrollTo", { locator: target, direction: "up", maxSwipes: 1 })).rejects.toThrow();
      const swipeArgs = driver.callsTo("execute").filter((c) => c.args[0] === "mobile: swipeGesture");
      expect((swipeArgs[0].args[1] as any).direction).toBe("down");
    });

    it("gives up after maxSwipes, naming the locator", async () => {
      const { run, driver } = await setup();
      await expect(run("mobile.scrollTo", { locator: target, maxSwipes: 3 })).rejects.toThrow(
        '{ by: "accessibilityId", value: "Target" } not found after 3 swipes',
      );
      expect(executes(driver).filter((args) => args[0] === "mobile: swipeGesture")).toHaveLength(3);
    });

    it("does not keep scrolling when the locator is ambiguous", async () => {
      const { run, driver } = await setup();
      driver.add("~Target", new FakeElement(), new FakeElement());
      await expect(run("mobile.scrollTo", { locator: target })).rejects.toThrow("matched 2 elements");
      expect(executes(driver)).toHaveLength(0);
    });

    it("validates its options", async () => {
      const { run } = await setup();
      await expect(run("mobile.scrollTo", { locator: target, direction: "left" })).rejects.toThrow(
        '"direction" must be down or up for op "mobile.scrollTo"',
      );
      await expect(run("mobile.scrollTo", { locator: target, maxSwipes: 0 })).rejects.toThrow(
        '"maxSwipes" must be a whole number >= 1 for op "mobile.scrollTo"',
      );
      await expect(run("mobile.scrollTo", {})).rejects.toThrow('Missing "locator" in step.with for op "mobile.scrollTo"');
    });
  });

  describe("assertions", () => {
    const title = { by: "accessibilityId", value: "Title" };

    it("expectVisible passes for a displayed element and fails for a missing one", async () => {
      const { run, driver } = await setup();
      driver.add("~Title", new FakeElement());
      await run("mobile.expectVisible", { locator: title });
      await expect(run("mobile.expectVisible", { locator: { by: "accessibilityId", value: "Nope" }, timeoutMs: 2000 })).rejects.toThrow(
        'No element matches { by: "accessibilityId", value: "Nope" } after 2000 ms',
      );
    });

    it("expectHidden passes when absent, and fails while visible", async () => {
      const { run, driver } = await setup();
      driver.add("~Title", new FakeElement());
      await run("mobile.expectHidden", { locator: { by: "accessibilityId", value: "Gone" } });
      await expect(run("mobile.expectHidden", { locator: title, timeoutMs: 1000 })).rejects.toThrow("is still visible after 1000 ms");
    });

    it("getText returns the text", async () => {
      const { run, driver } = await setup();
      driver.add("~Title", new FakeElement({ text: "Hello" }));
      expect(await run("mobile.getText", { locator: title })).toBe("Hello");
    });

    describe("expectText", () => {
      it("equals", async () => {
        const { run, driver } = await setup();
        driver.add("~Title", new FakeElement({ text: "Hello" }));
        expect(await run("mobile.expectText", { locator: title, equals: "Hello" })).toBe("Hello");
        await expect(run("mobile.expectText", { locator: title, equals: "Bye" })).rejects.toThrow(
          'Expected text of { by: "accessibilityId", value: "Title" } to equal "Bye", got "Hello"',
        );
      });

      it("contains", async () => {
        const { run, driver } = await setup();
        driver.add("~Title", new FakeElement({ text: "Hello world" }));
        await run("mobile.expectText", { locator: title, contains: "world" });
        await expect(run("mobile.expectText", { locator: title, contains: "moon" })).rejects.toThrow(
          'to contain "moon", got "Hello world"',
        );
      });

      it("matches", async () => {
        const { run, driver } = await setup();
        driver.add("~Title", new FakeElement({ text: "Order 123" }));
        await run("mobile.expectText", { locator: title, matches: "^Order \\d+$" });
        await expect(run("mobile.expectText", { locator: title, matches: "^Cart" })).rejects.toThrow('to match "^Cart"');
      });

      it("needs exactly one comparison", async () => {
        const { run } = await setup();
        const message = 'mobile.expectText needs exactly one of "equals", "contains", "matches"';
        await expect(run("mobile.expectText", { locator: title })).rejects.toThrow(message);
        await expect(run("mobile.expectText", { locator: title, equals: "a", contains: "b" })).rejects.toThrow(message);
      });

      it("rejects an invalid regular expression before touching the device", async () => {
        const { run, driver } = await setup();
        await expect(run("mobile.expectText", { locator: title, matches: "(" })).rejects.toThrow(
          '"matches" is not a valid regular expression',
        );
        expect(driver.callsTo("$$")).toHaveLength(0);
      });
    });
  });
});
