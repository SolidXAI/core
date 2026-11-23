import * as http from "http";
import type { AddressInfo } from "net";

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
    res.end("<html><body>ok</body></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("PlaywrightAdapter sessionStorage and contexts", () => {
  it("captures sessionStorage, seeds a new context without overwriting, and keeps every video clip", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the Playwright-backed adapter test");
      return;
    }
    const adapter = new PlaywrightAdapter({ baseUrl, recordVideo: true });
    await adapter.start();
    try {
      await adapter.page!.goto(baseUrl);
      await adapter.page!.evaluate(() => {
        sessionStorage.setItem("x", "1");
        localStorage.setItem("l", "1");
        document.cookie = "c=1; path=/";
      });
      const captured = await adapter.captureSessionStorage();
      expect(captured).toEqual({ [baseUrl]: { x: "1" } });
      expect(Object.keys(await adapter.storageState())).toEqual(expect.arrayContaining(["cookies", "origins"]));

      await adapter.newContext({ sessionStorage: { ...captured, "http://other.invalid": { y: "2" } } });
      await adapter.page!.goto(baseUrl);
      expect(await adapter.page!.evaluate(() => sessionStorage.getItem("x"))).toBe("1");
      // A reload must not overwrite what the page changed.
      await adapter.page!.evaluate(() => sessionStorage.setItem("x", "changed"));
      await adapter.page!.reload();
      expect(await adapter.page!.evaluate(() => sessionStorage.getItem("x"))).toBe("changed");

      // A plain new context sees none of it.
      await adapter.newContext();
      await adapter.page!.goto(baseUrl);
      expect(
        await adapter.page!.evaluate(() => [sessionStorage.getItem("x"), localStorage.getItem("l"), document.cookie]),
      ).toEqual([null, null, ""]);

      // closeContext twice is safe and the browser stays up for another context.
      await adapter.closeContext();
      await adapter.closeContext();
      await adapter.newContext();
      await adapter.page!.goto(baseUrl);
    } finally {
      await adapter.stop({ keepVideo: true });
    }
    // four contexts opened (start + three newContext) -> four clips, joined into one video or kept as separate files
    const timeline = adapter.getRunVideoTimeline();
    expect(timeline?.clips.map((c) => c.name)).toEqual(adapter.getRunVideos().map((v) => v.name));
    if (timeline?.oneFile) expect(adapter.getRunVideos()).toHaveLength(1);
    else expect(adapter.getRunVideos()).toHaveLength(4);
  }, 120_000);

  it("never re-seeds a key the app removed or cleared (logout stays logged out)", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the Playwright-backed adapter test");
      return;
    }
    const adapter = new PlaywrightAdapter({ baseUrl, recordVideo: false });
    await adapter.start();
    try {
      await adapter.newContext({ sessionStorage: { [baseUrl]: { token: "t", other: "o" } } });
      await adapter.page!.goto(`${baseUrl}/home`);
      expect(await adapter.page!.evaluate(() => sessionStorage.getItem("token"))).toBe("t");

      // logout by removing one key, then navigate
      await adapter.page!.evaluate(() => sessionStorage.removeItem("token"));
      await adapter.page!.goto(`${baseUrl}/login`);
      expect(await adapter.page!.evaluate(() => sessionStorage.getItem("token"))).toBeNull();
      expect(await adapter.page!.evaluate(() => sessionStorage.getItem("other"))).toBe("o");

      // logout by clearing everything, then navigate and reload
      await adapter.page!.evaluate(() => sessionStorage.clear());
      await adapter.page!.goto(`${baseUrl}/login`);
      await adapter.page!.reload();
      expect(await adapter.page!.evaluate(() => sessionStorage.length)).toBe(0);
    } finally {
      await adapter.stop();
    }
  }, 120_000);

  it("round-trips IndexedDB through storageState into a new context, and a plain context has none", async () => {
    if (!chromiumAvailable) {
      console.warn("Chromium is not installed; skipping the Playwright-backed adapter test");
      return;
    }
    const adapter = new PlaywrightAdapter({ baseUrl, recordVideo: false });
    await adapter.start();
    const readBack = () =>
      adapter.page!.evaluate(
        () =>
          new Promise<unknown>((resolve, reject) => {
            const open = indexedDB.open("db");
            open.onupgradeneeded = () => open.result.createObjectStore("kv");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const req = open.result.transaction("kv").objectStore("kv").get("k1");
              req.onsuccess = () => {
                open.result.close();
                resolve(req.result);
              };
              req.onerror = () => reject(req.error);
            };
          }),
      );
    try {
      await adapter.page!.goto(baseUrl);
      await adapter.page!.evaluate(
        () =>
          new Promise<void>((resolve, reject) => {
            const open = indexedDB.open("db", 1);
            open.onupgradeneeded = () => open.result.createObjectStore("kv");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const tx = open.result.transaction("kv", "readwrite");
              tx.objectStore("kv").put("v1", "k1");
              tx.oncomplete = () => {
                open.result.close();
                resolve();
              };
              tx.onerror = () => reject(tx.error);
            };
          }),
      );
      const state = await adapter.storageState();

      await adapter.newContext({ storageState: state });
      await adapter.page!.goto(baseUrl);
      expect(await readBack()).toBe("v1");

      await adapter.newContext();
      await adapter.page!.goto(baseUrl);
      expect(await readBack()).toBeUndefined();
    } finally {
      await adapter.stop();
    }
  }, 120_000);
});
