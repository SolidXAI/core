import * as http from "http";
import type { AddressInfo } from "net";

import type { RunFrameSink, RunLiveFrame } from "../../runner/run-live-frames";
import { isChromiumInstalled } from "./browser-provisioner";
import { PlaywrightAdapter } from "./playwright-adapter";

// Needs a real Chromium; skipped (not failed) when it is not installed on this machine.
let chromiumAvailable = false;
let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  chromiumAvailable = await isChromiumInstalled().catch(() => false);
  server = http.createServer((_req, res) => {
    res.setHeader("content-type", "text/html");
    res.end("<html><body><h1>live</h1></body></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function fakeSink(watching: boolean) {
  const frames: RunLiveFrame[] = [];
  const listeners = new Set<() => void>();
  let viewers = watching;
  const sink: RunFrameSink = {
    hasViewers: () => viewers,
    onViewersChanged: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    push: (f) => frames.push(f),
  };
  return { sink, frames, setViewers: (v: boolean) => { viewers = v; listeners.forEach((l) => l()); } };
}

const until = async (cond: () => boolean, ms = 10_000) => {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
};

describe("PlaywrightAdapter live frames", () => {
  it("streams frames of a filmed context while someone watches, and nothing without viewers", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the Playwright-backed adapter test");
      return;
    }
    const watched = fakeSink(true);
    const adapter = new PlaywrightAdapter({ baseUrl, recordVideo: false, liveFrames: watched.sink });
    await adapter.start();
    try {
      await adapter.page!.goto(baseUrl);
      await until(() => watched.frames.length > 0);
      expect(watched.frames.length).toBeGreaterThan(0);
      expect(watched.frames[0].data.length).toBeGreaterThan(0);
      expect(watched.frames[0].url).toContain(baseUrl);

      // Viewers leave: the screencast stops.
      watched.setViewers(false);
      await new Promise((r) => setTimeout(r, 500));
      const before = watched.frames.length;
      await adapter.page!.goto(`${baseUrl}/other`);
      await new Promise((r) => setTimeout(r, 500));
      expect(watched.frames.length).toBe(before);
    } finally {
      await adapter.stop();
    }

    // Unfilmed contexts (setups) are never streamed, even with viewers.
    const setup = fakeSink(true);
    const adapter2 = new PlaywrightAdapter({ baseUrl, recordVideo: false, recordInitialContext: false, liveFrames: setup.sink });
    await adapter2.start();
    try {
      await adapter2.page!.goto(baseUrl);
      await new Promise((r) => setTimeout(r, 800));
      expect(setup.frames).toHaveLength(0);
    } finally {
      await adapter2.stop();
    }
  }, 120_000);
});
