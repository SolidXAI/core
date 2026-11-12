import { execFile } from "child_process";

/**
 * The whole-run video and where each scenario is in it.
 *
 * Playwright records one clip per browser context, so a run that opens a new context for `session: restore|fresh`
 * has several. They are joined into one file with ffmpeg (from SOLID_FFMPEG_PATH, else `ffmpeg` on the PATH);
 * without ffmpeg the clips stay separate and the timeline says which clip each scenario is in.
 */

/** One recorded clip: when its page was open (wall clock) and how long the clip actually is. */
export interface ClipTiming {
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

/** One scenario attempt, by wall clock. */
export interface ScenarioMark {
  scenarioId: string;
  name?: string;
  attempt: number;
  ok: boolean;
  startedAt: number;
  endedAt: number;
}

export interface RunVideoTimeline {
  version: 1;
  /** Every scenario is in one file: the clips were joined, or there was only one. */
  oneFile: boolean;
  clips: Array<{ name: string; durationMs: number }>;
  /** Times are milliseconds into `clips[clip]`. */
  scenarios: Array<{ scenarioId: string; name?: string; attempt: number; ok: boolean; clip: number; startMs: number; endMs: number }>;
}

/**
 * Where wall-clock time `t` is in the recording: the clip and how far into it. Recording starts a moment after the
 * page opens but runs until the context closes, so the position is measured back from the clip's end. A time
 * between two clips (a context switch) is the start of the next one.
 */
export function videoPosition(clips: ClipTiming[], t: number): { clip: number; ms: number } {
  for (const [clip, c] of clips.entries()) {
    if (t > c.endedAt) continue;
    if (t < c.startedAt) return { clip, ms: 0 };
    return { clip, ms: Math.min(c.durationMs, Math.max(0, c.durationMs - (c.endedAt - t))) };
  }
  const last = clips.length - 1;
  return { clip: last, ms: clips[last]?.durationMs ?? 0 };
}

/**
 * The timeline of a run's video. `oneFile`: the clips are joined in order into one file, so every time is into
 * that file. Scenarios that ran while nothing was recording (e.g. API scenarios before the browser opened) are left out.
 */
export function buildTimeline(clips: ClipTiming[], names: string[], marks: ScenarioMark[], oneFile: boolean): RunVideoTimeline {
  const offsets = clips.map((_, i) => clips.slice(0, i).reduce((sum, c) => sum + c.durationMs, 0));
  const first = clips[0];
  const last = clips[clips.length - 1];
  const scenarios = !first
    ? []
    : marks
        .filter((m) => m.endedAt >= first.startedAt && m.startedAt <= last.endedAt)
        .map((m) => {
          const start = videoPosition(clips, m.startedAt);
          const end = videoPosition(clips, m.endedAt);
          // Separate clips: a scenario cannot run past the end of the clip it started in.
          const endMs = end.clip === start.clip ? end.ms : clips[start.clip].durationMs;
          const at = (clip: number, ms: number) => (oneFile ? offsets[clip] + ms : ms);
          return {
            scenarioId: m.scenarioId,
            ...(m.name ? { name: m.name } : {}),
            attempt: m.attempt,
            ok: m.ok,
            clip: oneFile ? 0 : start.clip,
            startMs: Math.round(at(start.clip, start.ms)),
            endMs: Math.round(oneFile ? at(end.clip, end.ms) : endMs),
          };
        });
  const total = clips.reduce((sum, c) => sum + c.durationMs, 0);
  return {
    version: 1,
    oneFile,
    clips: oneFile ? [{ name: names[0], durationMs: Math.round(total) }] : clips.map((c, i) => ({ name: names[i], durationMs: Math.round(c.durationMs) })),
    scenarios,
  };
}

function run(bin: string, args: string[]): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { maxBuffer: 4 * 1024 * 1024, timeout: 120_000 }, (error, _stdout, stderr) => {
      resolve({ ok: !error, stderr: String(stderr ?? "") });
    });
  });
}

/** The ffmpeg to use, or undefined when there is none. */
export async function findFfmpeg(): Promise<string | undefined> {
  const bin = process.env.SOLID_FFMPEG_PATH?.trim() || "ffmpeg";
  return (await run(bin, ["-hide_banner", "-version"])).ok ? bin : undefined;
}

/** A clip's length from ffmpeg's "Duration: 00:00:02.44" line, or undefined. */
export async function clipDurationMs(ffmpeg: string, file: string): Promise<number | undefined> {
  const { stderr } = await run(ffmpeg, ["-hide_banner", "-i", file]);
  return parseDurationMs(stderr);
}

export function parseDurationMs(ffmpegOutput: string): number | undefined {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(ffmpegOutput);
  if (!m) return undefined;
  return (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000;
}

/** Join same-size WebM clips into `out` without re-encoding. */
export async function joinClips(ffmpeg: string, files: string[], listFile: string, out: string): Promise<boolean> {
  const fs = await import("fs");
  const quote = (f: string) => `file '${f.replace(/'/g, "'\\''")}'`;
  await fs.promises.writeFile(listFile, files.map(quote).join("\n") + "\n");
  const { ok } = await run(ffmpeg, ["-hide_banner", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", out]);
  return ok && fs.existsSync(out);
}
