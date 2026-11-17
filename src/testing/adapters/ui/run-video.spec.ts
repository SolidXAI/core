import { buildTimeline, parseDurationMs, videoPosition, type ClipTiming, type ScenarioMark } from "./run-video";

// Two contexts as Playwright records them: each clip is a little shorter than its page was open,
// because recording starts a moment after the page opens.
const CLIPS: ClipTiming[] = [
  { startedAt: 1_000, endedAt: 3_650, durationMs: 2_440 },
  { startedAt: 3_700, endedAt: 7_870, durationMs: 3_920 },
];

const mark = (scenarioId: string, startedAt: number, endedAt: number, ok = true, attempt = 1): ScenarioMark => ({
  scenarioId,
  attempt,
  ok,
  startedAt,
  endedAt,
});

describe("run video timeline", () => {
  it("measures a time back from the end of its clip", () => {
    expect(videoPosition(CLIPS, 3_650)).toEqual({ clip: 0, ms: 2_440 });
    expect(videoPosition(CLIPS, 2_650)).toEqual({ clip: 0, ms: 1_440 });
    // The moment the page opened is before the recording started: clamp to 0.
    expect(videoPosition(CLIPS, 1_000)).toEqual({ clip: 0, ms: 0 });
  });

  it("puts a time between two clips at the start of the next", () => {
    expect(videoPosition(CLIPS, 3_680)).toEqual({ clip: 1, ms: 0 });
    expect(videoPosition(CLIPS, 9_000)).toEqual({ clip: 1, ms: 3_920 });
  });

  it("gives every scenario its place in the joined file", () => {
    const timeline = buildTimeline(CLIPS, ["run.webm"], [
      mark("login", 1_100, 3_600),
      mark("tasks-list", 4_000, 5_000),
      mark("task-create", 5_000, 7_800, false),
    ], true);

    expect(timeline.oneFile).toBe(true);
    expect(timeline.clips).toEqual([{ name: "run.webm", durationMs: 6_360 }]);
    expect(timeline.scenarios).toEqual([
      { scenarioId: "login", attempt: 1, ok: true, clip: 0, startMs: 0, endMs: 2_390 },
      // Second clip starts at 2440 in the joined file.
      { scenarioId: "tasks-list", attempt: 1, ok: true, clip: 0, startMs: 2_440 + 50, endMs: 2_440 + 1_050 },
      { scenarioId: "task-create", attempt: 1, ok: false, clip: 0, startMs: 2_440 + 1_050, endMs: 2_440 + 3_850 },
    ]);
  });

  it("keeps clip-relative times when the clips stay separate", () => {
    const timeline = buildTimeline(CLIPS, ["run-1.webm", "run-2.webm"], [mark("tasks-list", 4_000, 5_000)], false);
    expect(timeline.oneFile).toBe(false);
    expect(timeline.clips).toEqual([
      { name: "run-1.webm", durationMs: 2_440 },
      { name: "run-2.webm", durationMs: 3_920 },
    ]);
    expect(timeline.scenarios).toEqual([{ scenarioId: "tasks-list", attempt: 1, ok: true, clip: 1, startMs: 50, endMs: 1_050 }]);
  });

  it("leaves out scenarios that ran while nothing was recording, and keeps retries apart", () => {
    const timeline = buildTimeline(CLIPS, ["run.webm"], [
      mark("api-health", 100, 900),
      mark("flaky", 4_000, 4_500, false, 1),
      mark("flaky", 4_500, 5_000, true, 2),
    ], true);
    expect(timeline.scenarios.map((s) => `${s.scenarioId}#${s.attempt}:${s.ok}`)).toEqual(["flaky#1:false", "flaky#2:true"]);
  });

  it("reads ffmpeg's duration line", () => {
    expect(parseDurationMs("  Duration: 00:00:06.36, start: 0.000000, bitrate: 19 kb/s")).toBe(6_360);
    expect(parseDurationMs("  Duration: 01:02:03.50, start: 0")).toBe(3_723_500);
    expect(parseDurationMs("Duration: N/A")).toBeUndefined();
  });
});
