import { toSyslogConsoleEntries } from "./syslog";

const app = { processName: "SampleApp", bundleId: "io.solidx.testhub.sample" };
const line = (level: string, proc: string, text: string) =>
  ({ level: "ALL", message: `2026-10-13 21:53:23.018 ${level} ${proc}[45761:53f83] [com.x:y] ${text}` });

describe("toSyslogConsoleEntries", () => {
  it("keeps every line of the app's own process, mapping the level", () => {
    const entries = [line("Db", "SampleApp", "debug"), line("I", "SampleApp", "info"), line("Df", "SampleApp", "default"), line("E", "SampleApp", "boom")];
    expect(toSyslogConsoleEntries(entries, app, 500).map((e) => e.type)).toEqual(["debug", "info", "info", "error"]);
  });

  it("drops other processes' lines", () => {
    const entries = [line("I", "locationd", "noise"), line("Df", "SpringBoard", "more noise")];
    expect(toSyslogConsoleEntries(entries, app, 500)).toEqual([]);
  });

  it("keeps errors and faults from other processes only when they name the app", () => {
    const entries = [
      line("E", "runningboardd", `Failed to launch ${app.bundleId}`),
      line("Fa", "kernel", "unrelated fault"),
      line("I", "runningboardd", `Launched ${app.bundleId}`),
    ];
    const kept = toSyslogConsoleEntries(entries, app, 500);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ type: "error" });
    expect(kept[0].text).toContain("Failed to launch");
  });

  it("skips lines that do not look like log lines", () => {
    const entries = [{ level: "ALL", message: "Timestamp               Ty Process[PID:TID]" }, { level: "ALL", message: "getpwuid_r did not find a match for uid 501" }];
    expect(toSyslogConsoleEntries(entries, app, 500)).toEqual([]);
  });

  it("works without a process name, relying on errors that name the app", () => {
    const entries = [line("I", "SampleApp", "own"), line("E", "x", `bad ${app.bundleId}`)];
    expect(toSyslogConsoleEntries(entries, { bundleId: app.bundleId }, 500)).toHaveLength(1);
  });

  it("returns the newest lines when over the limit", () => {
    const entries = Array.from({ length: 10 }, (_, i) => line("I", "SampleApp", `n${i}`));
    const kept = toSyslogConsoleEntries(entries, app, 3);
    expect(kept.map((e) => e.text.slice(-2))).toEqual(["n7", "n8", "n9"]);
  });
});

describe("toSyslogConsoleEntries: a real iPhone's lines (D48)", () => {
  // Lines in the shape of a capture from an iPhone 16 on iOS 26.6.1 (see spikes/mobile-ios/FINDINGS-ios-device.md),
  // with the host name changed.
  const device = (proc: string, level: string, text: string, subsystem = "") =>
    ({ level: "ALL", message: `Oct 16 07:23:55 Test-iPhone ${proc}${subsystem ? `(${subsystem})` : ""}[2006] <${level}>: ${text}` });
  const phone = { processName: "My Demo App", bundleId: "com.oswald.mydemoapp" };

  it("keeps the app's own process, even when its name has spaces and it names a subsystem", () => {
    const kept = toSyslogConsoleEntries(
      [device("My Demo App", "Notice", "HTAssertion: HTBeginAssertion: track assertionId=136", "HangTracer"), device("My Demo App", "Notice", "plain")],
      phone,
      500,
    );
    expect(kept).toHaveLength(2);
    expect(kept[0].text).toContain("HTBeginAssertion");
  });

  it("drops WebDriverAgent's and the system's lines", () => {
    const kept = toSyslogConsoleEntries(
      [
        device("WebDriverAgentRunner-Runner", "Notice", "nw_connection_report_state_with_handler_on_nw_queue", "Network"),
        device("inputanalyticsd", "Error", "textInputSessionId '<private>' already exists!", "InputAnalyticsServer"),
        device("testmanagerd", "Error", "Uncaptured runtime issue reported: <private>", "XCTAutomationSupport"),
      ],
      phone,
      500,
    );
    expect(kept).toEqual([]);
  });

  it("keeps an error from another process only when it names the app", () => {
    const kept = toSyslogConsoleEntries(
      [device("runningboardd", "Error", `Failed to launch ${phone.bundleId}`), device("runningboardd", "Error", "unrelated"), device("runningboardd", "Notice", `Launched ${phone.bundleId}`)],
      phone,
      500,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ type: "error" });
  });

  it.each([
    ["Debug", "debug"],
    ["Info", "info"],
    ["Notice", "info"],
    ["Error", "error"],
    ["Fault", "error"],
    ["Surprise", "info"],
  ])("maps the level %s to %s", (level, type) => {
    expect(toSyslogConsoleEntries([device("My Demo App", level, "x")], phone, 500)[0].type).toBe(type);
  });

  it("skips the continuation lines a multi-line message leaves behind", () => {
    const entries = [{ level: "ALL", message: "\t{name: Thermal Policy, policyWeight: 5.000, response: {100, 0.00}}" }, { level: "ALL", message: " ], Decision: AMNP}" }];
    expect(toSyslogConsoleEntries(entries, phone, 500)).toEqual([]);
  });

  it("reads a phone's lines and a simulator's together", () => {
    const entries = [device("My Demo App", "Notice", "from the phone"), line("I", "SampleApp", "from the simulator")];
    expect(toSyslogConsoleEntries(entries, { processName: "My Demo App", bundleId: "x.y" }, 500)).toHaveLength(1);
    expect(toSyslogConsoleEntries(entries, { processName: "SampleApp", bundleId: "x.y" }, 500)).toHaveLength(1);
  });
});
