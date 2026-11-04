import { resolveLocator } from "./locator";

const ctx = { appPackage: "com.acme.app" };

describe("resolveLocator", () => {
  it("maps accessibilityId to ~value", () => {
    expect(resolveLocator({ by: "accessibilityId", value: "Login button" }, ctx).selector).toBe("~Login button");
  });

  it("maps xpath through unchanged", () => {
    const xpath = '//android.widget.EditText[@content-desc="Username"]';
    expect(resolveLocator({ by: "xpath", value: xpath }, ctx).selector).toBe(xpath);
  });

  it("maps uiautomator to an android= selector", () => {
    const expr = 'new UiSelector().className("android.widget.Button").instance(1)';
    expect(resolveLocator({ by: "uiautomator", value: expr }, ctx).selector).toBe(`android=${expr}`);
  });

  it.each([
    ["text", "text"],
    ["textContains", "textContains"],
    ["description", "description"],
  ] as const)("maps %s to a UiSelector call", (by, method) => {
    expect(resolveLocator({ by, value: "Save" }, ctx).selector).toBe(`android=new UiSelector().${method}("Save")`);
  });

  it("escapes quotes and backslashes inside UiSelector strings", () => {
    const { selector } = resolveLocator({ by: "text", value: 'say "hi" \\ now' }, ctx);
    expect(selector).toBe('android=new UiSelector().text("say \\"hi\\" \\\\ now")');
  });

  describe("id", () => {
    it("prefixes a bare id with the app package", () => {
      expect(resolveLocator({ by: "id", value: "edit" }, ctx).selector).toBe("id=com.acme.app:id/edit");
    });

    it("keeps an id that already has a package", () => {
      expect(resolveLocator({ by: "id", value: "android:id/text1" }, ctx).selector).toBe("id=android:id/text1");
      expect(resolveLocator({ by: "id", value: "io.other:id/x" }, ctx).selector).toBe("id=io.other:id/x");
    });
  });

  describe("platform overrides", () => {
    it("uses the android block instead of by/value/index", () => {
      const resolved = resolveLocator(
        {
          by: "accessibilityId",
          value: "Login",
          android: { by: "id", value: "login", index: 2 },
          ios: { by: "accessibilityId", value: "ios-login" },
        },
        ctx,
      );
      expect(resolved.selector).toBe("id=com.acme.app:id/login");
      expect(resolved.index).toBe(2);
    });

    it("ignores the ios block on Android", () => {
      const resolved = resolveLocator(
        { by: "accessibilityId", value: "Login", ios: { by: "id", value: "other" } },
        ctx,
      );
      expect(resolved.selector).toBe("~Login");
    });

    it("validates the android block", () => {
      expect(() => resolveLocator({ by: "accessibilityId", value: "x", android: "nope" }, ctx)).toThrow(
        "locator.android must be an object",
      );
      expect(() => resolveLocator({ by: "id", value: "x", android: { by: "bogus", value: "y" } }, ctx)).toThrow(
        "locator.by must be one of",
      );
    });
  });

  describe("index and label", () => {
    it("passes index through", () => {
      expect(resolveLocator({ by: "accessibilityId", value: "Save", index: 1 }, ctx).index).toBe(1);
    });

    it("has no index when none is given", () => {
      expect(resolveLocator({ by: "accessibilityId", value: "Save" }, ctx).index).toBeUndefined();
    });

    it("builds a readable label", () => {
      expect(resolveLocator({ by: "accessibilityId", value: "Save" }, ctx).label).toBe(
        '{ by: "accessibilityId", value: "Save" }',
      );
      expect(resolveLocator({ by: "accessibilityId", value: "Save", index: 1 }, ctx).label).toBe(
        '{ by: "accessibilityId", value: "Save", index: 1 }',
      );
    });
  });

  describe("errors", () => {
    it.each([["Login button"], [42], [null], [undefined], [["x"]]])("rejects a non-object locator (%p)", (input) => {
      expect(() => resolveLocator(input, ctx)).toThrow(
        'locator must be an object like { "by": "accessibilityId", "value": "Login button" }',
      );
    });

    it("rejects an unknown or missing by", () => {
      expect(() => resolveLocator({ by: "css", value: "x" }, ctx)).toThrow(
        "locator.by must be one of: accessibilityId, id, text, textContains, description, uiautomator, iosPredicate, iosClassChain, xpath",
      );
      expect(() => resolveLocator({ value: "x" }, ctx)).toThrow("locator.by must be one of");
    });

    it.each([[""], [undefined], [7]])("rejects an empty or non-string value (%p)", (value) => {
      expect(() => resolveLocator({ by: "id", value }, ctx)).toThrow("locator.value must be a non-empty string");
    });

    it.each([[-1], [1.5], ["1"], [null]])("rejects a bad index (%p)", (index) => {
      expect(() => resolveLocator({ by: "id", value: "x", index }, ctx)).toThrow(
        "locator.index must be a whole number >= 0",
      );
    });
  });
});

describe("resolveLocator: iOS", () => {
  const ios = { appPackage: "io.solidx.testhub.sample", platform: "iOS" as const };

  it.each(["accessibilityId", "id", "description"] as const)("maps %s to ~value", (by) => {
    expect(resolveLocator({ by, value: "Login button" }, ios).selector).toBe("~Login button");
  });

  it("maps text and textContains to predicates over label and value", () => {
    expect(resolveLocator({ by: "text", value: "Save" }, ios).selector).toBe(
      '-ios predicate string:label == "Save" OR value == "Save"',
    );
    expect(resolveLocator({ by: "textContains", value: "Sav" }, ios).selector).toBe(
      '-ios predicate string:label CONTAINS "Sav" OR value CONTAINS "Sav"',
    );
  });

  it("escapes quotes and backslashes in predicates", () => {
    expect(resolveLocator({ by: "text", value: 'say "hi" \\ now' }, ios).selector).toBe(
      '-ios predicate string:label == "say \\"hi\\" \\\\ now" OR value == "say \\"hi\\" \\\\ now"',
    );
  });

  it("maps the raw iOS strategies", () => {
    expect(resolveLocator({ by: "iosPredicate", value: 'name BEGINSWITH "com.apple"' }, ios).selector).toBe(
      '-ios predicate string:name BEGINSWITH "com.apple"',
    );
    expect(resolveLocator({ by: "iosClassChain", value: "**/XCUIElementTypeButton[`label == 'Save'`]" }, ios).selector).toBe(
      "-ios class chain:**/XCUIElementTypeButton[`label == 'Save'`]",
    );
  });

  it("maps xpath through unchanged and keeps the index", () => {
    const result = resolveLocator({ by: "xpath", value: "(//XCUIElementTypeButton)[2]", index: 1 }, ios);
    expect(result.selector).toBe("(//XCUIElementTypeButton)[2]");
    expect(result.index).toBe(1);
  });

  it("refuses uiautomator on iOS, naming the replacement", () => {
    expect(() => resolveLocator({ by: "uiautomator", value: "new UiSelector()" }, ios)).toThrow(
      'locator.by "uiautomator" only works on Android; on iOS use "iosPredicate" or "iosClassChain"',
    );
  });

  it("refuses the iOS strategies on Android, naming the replacement", () => {
    const android = { appPackage: "com.acme.app" };
    expect(() => resolveLocator({ by: "iosPredicate", value: "name == 'x'" }, android)).toThrow(
      'locator.by "iosPredicate" only works on iOS; on Android use "uiautomator"',
    );
    expect(() => resolveLocator({ by: "iosClassChain", value: "**/X" }, { ...android, platform: "Android" })).toThrow(
      'locator.by "iosClassChain" only works on iOS',
    );
  });

  it("uses the ios override on iOS and ignores the android one", () => {
    const locator = {
      by: "id",
      value: "username_field",
      android: { by: "text", value: "Username" },
      ios: { by: "accessibilityId", value: "Username input field" },
    };
    expect(resolveLocator(locator, ios).selector).toBe("~Username input field");
  });

  it("uses the android override on Android and ignores the ios one", () => {
    const locator = {
      by: "accessibilityId",
      value: "Username input field",
      android: { by: "id", value: "username_field" },
      ios: { by: "text", value: "Username" },
    };
    expect(resolveLocator(locator, { appPackage: "com.acme.app" }).selector).toBe("id=com.acme.app:id/username_field");
  });

  it("rejects a malformed ios override", () => {
    expect(() => resolveLocator({ by: "accessibilityId", value: "x", ios: "nope" }, ios)).toThrow(
      "locator.ios must be an object like",
    );
  });
});
