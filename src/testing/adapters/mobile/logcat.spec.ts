import { toConsoleEntries } from "./logcat";

const line = (priority: string, tag: string, msg: string) => `10-09 09:49:37.434   363  3815 ${priority} ${tag}: ${msg}`;
const entry = (message: string) => ({ level: "ALL", message });

describe("toConsoleEntries", () => {
  it("reads the priority from the line, since Appium reports every level as ALL", () => {
    const out = toConsoleEntries(
      [entry(line("W", "Foo", "careful")), entry(line("E", "Foo", "broke")), entry(line("F", "Foo", "fatal")), entry(line("A", "Foo", "assert"))],
      "com.acme.app",
      500,
    );
    expect(out.map((e) => e.type)).toEqual(["warning", "error", "error", "error"]);
  });

  it("keeps the whole line as the text", () => {
    const text = line("E", "AndroidRuntime", "FATAL EXCEPTION: main");
    expect(toConsoleEntries([entry(text)], "com.acme.app", 500)).toEqual([{ type: "error", text }]);
  });

  it("drops system chatter below warning", () => {
    const out = toConsoleEntries(
      [entry(line("I", "resolv", "resolv_cache_lookup")), entry(line("D", "wifi", "scan")), entry(line("V", "x", "y"))],
      "com.acme.app",
      500,
    );
    expect(out).toEqual([]);
  });

  it("keeps info and debug lines that mention the app, and the React Native, crash and WebView tags", () => {
    const out = toConsoleEntries(
      [
        entry(line("I", "ActivityManager", "Start proc 4242:com.acme.app/u0a1")),
        entry(line("I", "ReactNativeJS", "'login pressed'")),
        entry(line("D", "chromium", "[INFO:CONSOLE(3)] hi")),
        entry(line("I", "Unrelated", "noise")),
      ],
      "com.acme.app",
      500,
    );
    expect(out.map((e) => e.type)).toEqual(["info", "info", "debug"]);
    expect(out).toHaveLength(3);
  });

  it("falls back to the entry level for lines in an unknown format", () => {
    const out = toConsoleEntries([{ level: "SEVERE", message: "boom" }, { level: "INFO", message: "fine" }], "com.acme.app", 500);
    expect(out).toEqual([]);
    const mentioning = toConsoleEntries([{ level: "INFO", message: "com.acme.app started" }], "com.acme.app", 500);
    expect(mentioning).toEqual([{ type: "info", text: "com.acme.app started" }]);
  });

  it("returns only the newest entries when there are too many", () => {
    const many = Array.from({ length: 700 }, (_, i) => entry(line("E", "T", `m${i}`)));
    const out = toConsoleEntries(many, "com.acme.app", 500);
    expect(out).toHaveLength(500);
    expect(out[0].text).toContain("m200");
    expect(out[499].text).toContain("m699");
  });

  it("copes with missing fields", () => {
    expect(toConsoleEntries([{}, { message: undefined }], "com.acme.app", 5)).toEqual([]);
  });
});
