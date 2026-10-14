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
