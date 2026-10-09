// Opt-in integration checks: they drive a real Android emulator or phone through Appium.
//
// This is a plain script, not a Jest spec. WebdriverIO's network layer does not survive Jest's sandbox
// (it crashes the process), and plain Node is what a real run uses anyway.
//
// Needs, all running: Appium on MOBILE_IT_APPIUM, a device on MOBILE_IT_UDID, and `webdriverio` that Node can
// resolve. It is only an optional peer of this package, so point NODE_PATH at a folder that has it.
//
//   NODE_PATH=/path/to/node_modules npm run test:mobile
//
// MOBILE_IT_LONG=1 also runs the four-minute recording check. Exit code is 1 if any check fails.
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import type { MobileAdapterOptions } from "../adapters/mobile/mobile.types";
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { RecordingReporter } from "../runner/recording-reporter";
import { runFromMetadata } from "../runner/run-from-metadata";

const APPIUM = process.env.MOBILE_IT_APPIUM ?? "http://localhost:4723";
const UDID = process.env.MOBILE_IT_UDID ?? "emulator-5554";
const APPS_DIR =
  process.env.MOBILE_IT_APPS_DIR ?? "/Users/oswald/projects/Solid_Starters/test-hub/spikes/mobile-appium/apps";

const apiDemos: MobileAdapterOptions = {
  appiumUrl: APPIUM,
  udid: UDID,
  appSource: "upload",
  appPath: path.join(APPS_DIR, "ApiDemos-debug.apk"),
  appPackage: "io.appium.android.apis",
  capture: { console: true },
};
const rnDemo: MobileAdapterOptions = {
  appiumUrl: APPIUM,
  udid: UDID,
  appSource: "installed",
  appPackage: "com.saucelabs.mydemoapp.rn",
  appActivity: ".MainActivity",
  capture: { console: true },
};

const acc = (value: string) => ({ by: "accessibilityId", value });

const apiDemosFlow: ScenarioSpec = {
  id: "apidemos-controls",
  type: "mobile",
  steps: [
    { given: { op: "mobile.launch", with: { clearData: true } } },
    { when: { op: "mobile.tap", with: { locator: acc("Views") } } },
    { and: { op: "mobile.tap", with: { locator: acc("Controls") } } },
    { and: { op: "mobile.tap", with: { locator: acc("1. Light Theme") } } },
    // A bare id: exercises the app-package prefix.
    { and: { op: "mobile.type", with: { locator: { by: "id", value: "edit" }, text: "hello" } } },
    { then: { op: "mobile.expectText", with: { locator: { by: "id", value: "edit" }, equals: "hello" } } },
    { and: { op: "mobile.back" } },
    { and: { op: "mobile.back" } },
  ],
};

const rnLogin = (id: string): ScenarioSpec => ({
  id,
  type: "mobile",
  steps: [
    { given: { op: "mobile.launch", with: { clearData: true } } },
    { when: { op: "mobile.tap", with: { locator: acc("open menu") } } },
    { and: { op: "mobile.tap", with: { locator: acc("menu item log in") } } },
    { and: { op: "mobile.type", with: { locator: acc("Username input field"), text: "bob@example.com" } } },
    { and: { op: "mobile.type", with: { locator: acc("Password input field"), text: "10203040" } } },
    { and: { op: "mobile.hideKeyboard" } },
    { and: { op: "mobile.tap", with: { locator: acc("Login button") } } },
    { then: { op: "mobile.expectVisible", with: { locator: acc("products screen"), timeoutMs: 15000 } } },
  ],
});

/** Reads the duration, in seconds, from an MP4's movie header. */
function mp4Duration(data: Buffer): number {
  const at = data.indexOf("mvhd");
  const timescale = data.readUInt32BE(at + 16);
  return data.readUInt32BE(at + 20) / timescale;
}

const results: Array<{ name: string; ok: boolean; seconds: number; error?: string }> = [];
async function check(name: string, fn: () => Promise<void>) {
  const startedAt = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, seconds: Math.round((Date.now() - startedAt) / 1000) });
    console.log(`PASS  ${name}`);
  } catch (error: any) {
    results.push({ name, ok: false, seconds: Math.round((Date.now() - startedAt) / 1000), error: String(error?.message ?? error) });
    console.log(`FAIL  ${name}\n      ${String(error?.message ?? error).split("\n")[0]}`);
  }
}

async function main() {
  await check("ApiDemos: uploaded APK, bare-id locator, text assertion", async () => {
    const reporter = new RecordingReporter();
    await runFromMetadata({ scenarios: [apiDemosFlow], mobile: apiDemos, reporter });
    assert.deepEqual(reporter.scenarioEnds, [{ id: "apidemos-controls", ok: true }]);
    assert.deepEqual(reporter.runArtifacts, [], "a passing run keeps no recording");
  });

  await check("React Native demo: installed app; two logins in one run prove each scenario starts clean", async () => {
    const reporter = new RecordingReporter();
    await runFromMetadata({ scenarios: [rnLogin("rn-login-1"), rnLogin("rn-login-2")], mobile: rnDemo, reporter });
    assert.deepEqual(reporter.scenarioEnds, [
      { id: "rn-login-1", ok: true },
      { id: "rn-login-2", ok: true },
    ]);
  });

  await check("a failing scenario gets a screenshot, and the run gets the recording", async () => {
    const failing: ScenarioSpec = {
      id: "rn-fails",
      type: "mobile",
      steps: [
        { given: { op: "mobile.launch", with: { clearData: true } } },
        { then: { op: "mobile.expectVisible", with: { locator: acc("does-not-exist"), timeoutMs: 3000 } } },
      ],
    };
    const reporter = new RecordingReporter();
    await assert.rejects(
      runFromMetadata({ scenarios: [failing], mobile: rnDemo, reporter }),
      /No element matches \{ by: "accessibilityId", value: "does-not-exist" \} after 3000 ms/,
    );
    const names = reporter.attachments.filter((a) => a.scenarioId === "rn-fails").map((a) => a.name);
    assert.ok(names.includes("screenshot.png"), `screenshot.png missing, got: ${names.join(", ")}`);
    assert.deepEqual(reporter.runArtifacts.map((a) => a.name), ["run.mp4"]);
    assert.ok(reporter.runArtifacts[0].bytes > 1000, "recording looks empty");
    console.log(`      attachments: ${names.join(", ")}; recording ${reporter.runArtifacts[0].bytes} bytes`);
  });

  if (process.env.MOBILE_IT_LONG === "1") {
    await check("a four-minute run: how much of it does the recording cover?", async () => {
      const waits = Array.from({ length: 11 }, () => [
        { op: "util.sleep", with: { ms: 20_000 } },
        { op: "mobile.expectVisible", with: { locator: acc("products screen") } },
      ]).flat();
      const long: ScenarioSpec = {
        id: "rn-long",
        type: "mobile",
        steps: [
          { given: { op: "mobile.launch", with: { clearData: true } } },
          ...waits,
          { then: { op: "mobile.expectVisible", with: { locator: acc("does-not-exist"), timeoutMs: 2000 } } },
        ],
      };
      const captured: Buffer[] = [];
      const reporter = new RecordingReporter();
      const original = reporter.attachRunArtifact.bind(reporter);
      reporter.attachRunArtifact = (args: { name: string; data: Buffer | string }) => {
        captured.push(Buffer.from(args.data));
        original(args);
      };
      const startedAt = Date.now();
      await assert.rejects(runFromMetadata({ scenarios: [long], mobile: rnDemo, reporter }));
      assert.equal(captured.length, 1, "expected one recording");
      const outcome = {
        ranSeconds: Math.round((Date.now() - startedAt) / 1000),
        recordedSeconds: Math.round(mp4Duration(captured[0])),
        bytes: captured[0].length,
      };
      console.log(`      ${JSON.stringify(outcome)}`);
      const outDir = path.join(APPS_DIR, "..", "out");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "long-recording.json"), JSON.stringify(outcome, null, 2));
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

void main();
