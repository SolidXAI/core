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
        "locator.by must be one of: accessibilityId, id, text, textContains, description, uiautomator, xpath",
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
