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
//
// iOS Simulator instead of Android: boot a simulator and start Appium, then
//
//   MOBILE_IT_PLATFORM=ios MOBILE_IT_UDID=<simulator udid> NODE_PATH=/path/to/node_modules npm run test:mobile
//
// It installs the small sample app from the iOS spike (MOBILE_IT_IOS_APP, default
// test-hub/spikes/mobile-ios/sample-app/out/SampleApp.app, built by its build.sh). WebDriverAgent is cached in
// MOBILE_IT_WDA (default ~/.solidx/wda/xcode-27.0); the first run builds it, which takes minutes.
//
// A real iPhone instead, with the demo app already installed on it (from Xcode, TestFlight or the App Store). Plug the
// phone into this Mac with a USB cable, unlock it, start Appium, then
//
//   MOBILE_IT_PLATFORM=ios-device MOBILE_IT_UDID=<phone udid> MOBILE_IT_IOS_TEAM=<10-character team id> \
//     NODE_PATH=/path/to/node_modules npm run test:mobile
//
// The phone's UDID is in `xcrun devicectl list devices`; the team id is the OU of the "Apple Development" certificate.
// MOBILE_IT_IOS_BUNDLE (default com.oswald.mydemoapp) is the installed app's bundle id and MOBILE_IT_IOS_PROCESS (default
// "My Demo App") its executable, which names its lines in the device log. WebDriverAgent is built and signed for the
// phone into MOBILE_IT_WDA (default ~/.solidx/wda/xcode-27.0-iphoneos-<team>): the first run takes minutes, and the
// Mac's keychain asks for its password (answer Always Allow).
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { MobileAdapterOptions } from "../adapters/mobile/mobile.types";
import type { ScenarioSpec } from "../contracts/testing-metadata.types";
import { RecordingReporter } from "../runner/recording-reporter";
import { runFromMetadata } from "../runner/run-from-metadata";

const APPIUM = process.env.MOBILE_IT_APPIUM ?? "http://localhost:4723";
const UDID = process.env.MOBILE_IT_UDID ?? "emulator-5554";
const APPS_DIR =
  process.env.MOBILE_IT_APPS_DIR ?? "/Users/oswald/projects/Solid_Starters/test-hub/spikes/mobile-appium/apps";

const IOS = process.env.MOBILE_IT_PLATFORM === "ios";
const IOS_DEVICE = process.env.MOBILE_IT_PLATFORM === "ios-device";
const IOS_APP =
  process.env.MOBILE_IT_IOS_APP ??
  path.join(APPS_DIR, "..", "..", "mobile-ios", "sample-app", "out", "SampleApp.app");
const WDA_DIR = process.env.MOBILE_IT_WDA ?? path.join(os.homedir(), ".solidx", "wda", "xcode-27.0");

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

// ---- iOS Simulator: the spike's sample app (a login form, a persisted login, and a location button) -----------------------

const sampleApp = (): MobileAdapterOptions => ({
  appiumUrl: APPIUM,
  udid: UDID,
  platformName: "iOS",
  simulator: true,
  appSource: "upload",
  appPath: IOS_APP,
  appPackage: "io.solidx.testhub.sample",
  appProcessName: "SampleApp",
  wdaDerivedDataPath: WDA_DIR,
  wdaPrebuilt: fs.existsSync(path.join(WDA_DIR, "Build", "Products", "Debug-iphonesimulator", "WebDriverAgentRunner-Runner.app")),
  capture: { console: true },
});

const sampleLogin = (id: string): ScenarioSpec => ({
  id,
  type: "mobile",
  steps: [
    { given: { op: "mobile.launch", with: { clearData: true } } },
    { then: { op: "mobile.expectText", with: { locator: acc("status label"), equals: "Logged out" } } },
    { when: { op: "mobile.type", with: { locator: acc("Username input field"), text: "bob" } } },
    { and: { op: "mobile.type", with: { locator: acc("Password input field"), text: "secret-pass" } } },
    { and: { op: "mobile.hideKeyboard" } },
    { and: { op: "mobile.tap", with: { locator: acc("Login button") } } },
    { then: { op: "mobile.expectText", with: { locator: acc("status label"), equals: "Logged in as bob" } } },
  ],
});

async function iosChecks() {
  if (!process.env.MOBILE_IT_UDID) throw new Error("MOBILE_IT_UDID must be the booted simulator's UDID for MOBILE_IT_PLATFORM=ios");
  if (!fs.existsSync(IOS_APP)) throw new Error(`The sample app is not built: ${IOS_APP} (run spikes/mobile-ios/sample-app/build.sh)`);

  await check("iOS: login twice in one run; the second starts logged out, which proves the reinstall reset", async () => {
    const reporter = new RecordingReporter();
    await runFromMetadata({ scenarios: [sampleLogin("ios-login-1"), sampleLogin("ios-login-2")], mobile: sampleApp(), reporter });
    assert.deepEqual(reporter.scenarioEnds, [
      { id: "ios-login-1", ok: true },
      { id: "ios-login-2", ok: true },
    ]);
  });

  await check("iOS: permissions are granted after a reset, so no prompt blocks the location button", async () => {
    const scenario: ScenarioSpec = {
      id: "ios-location",
      type: "mobile",
      steps: [
        { given: { op: "mobile.launch", with: { clearData: true } } },
        { when: { op: "mobile.tap", with: { locator: acc("Location button") } } },
        // 4 is CLAuthorizationStatus.authorizedWhenInUse; an alert that autoAcceptAlerts accepted would leave 2 (denied).
        { then: { op: "mobile.expectText", with: { locator: acc("location label"), equals: "Location: 4" } } },
      ],
    };
    const reporter = new RecordingReporter();
    await runFromMetadata({ scenarios: [scenario], mobile: sampleApp(), reporter });
    assert.deepEqual(reporter.scenarioEnds, [{ id: "ios-location", ok: true }]);
  });

  await check("iOS: mobile.back on a screen with no back button fails instead of passing silently", async () => {
    const scenario: ScenarioSpec = {
      id: "ios-back",
      type: "mobile",
      steps: [{ given: { op: "mobile.launch" } }, { when: { op: "mobile.back" } }],
    };
    const reporter = new RecordingReporter();
    await assert.rejects(runFromMetadata({ scenarios: [scenario], mobile: sampleApp(), reporter }), /has no back button on iOS/);
  });

  await check("iOS: a failing scenario still gets the recording and the device log", async () => {
    const failing: ScenarioSpec = {
      id: "ios-fails",
      type: "mobile",
      steps: [
        { given: { op: "mobile.launch", with: { clearData: true } } },
        { then: { op: "mobile.expectVisible", with: { locator: acc("does-not-exist"), timeoutMs: 3000 } } },
      ],
    };
    const reporter = new RecordingReporter();
    await assert.rejects(
      runFromMetadata({ scenarios: [failing], mobile: sampleApp(), reporter }),
      /No element matches \{ by: "accessibilityId", value: "does-not-exist" \} after 3000 ms/,
    );
    const names = reporter.attachments.filter((a) => a.scenarioId === "ios-fails").map((a) => a.name);
    assert.deepEqual(reporter.runArtifacts.map((a) => a.name), ["run.mp4"]);
    assert.ok(reporter.runArtifacts[0].bytes > 1000, "recording looks empty");
    console.log(`      attachments: ${names.join(", ") || "(none)"}; recording ${reporter.runArtifacts[0].bytes} bytes`);
  });
}

// ---- A real iPhone: the demo app, already installed ---------------------------------------------------------------------

/** Keeps what a scenario attached, which the shared RecordingReporter drops. */
class ContentReporter extends RecordingReporter {
  contents = new Map<string, string>();
  attach(args: { scenarioId: string; name: string; contentType: string; data: Buffer | string }) {
    super.attach(args);
    this.contents.set(`${args.scenarioId}/${args.name}`, String(args.data));
  }
}

const phoneApp = (): MobileAdapterOptions => {
  const team = process.env.MOBILE_IT_IOS_TEAM ?? "";
  const wdaDir = process.env.MOBILE_IT_WDA ?? path.join(os.homedir(), ".solidx", "wda", `xcode-27.0-iphoneos-${team}`);
  return {
    appiumUrl: APPIUM,
    udid: UDID,
    platformName: "iOS",
    simulator: false,
    appSource: "installed",
    appPackage: process.env.MOBILE_IT_IOS_BUNDLE ?? "com.oswald.mydemoapp",
    appProcessName: process.env.MOBILE_IT_IOS_PROCESS ?? "My Demo App",
    wdaSigning: { teamId: team },
    wdaDerivedDataPath: wdaDir,
    wdaPrebuilt: fs.existsSync(path.join(wdaDir, "Build", "Products", "Debug-iphoneos", "WebDriverAgentRunner-Runner.app")),
    capture: { console: true },
  };
};

async function iosDeviceChecks() {
  if (!process.env.MOBILE_IT_UDID) throw new Error("MOBILE_IT_UDID must be the phone's UDID (xcrun devicectl list devices) for MOBILE_IT_PLATFORM=ios-device");
  if (!/^[A-Z0-9]{10}$/.test(process.env.MOBILE_IT_IOS_TEAM ?? "")) {
    throw new Error("MOBILE_IT_IOS_TEAM must be the 10-character Apple team id (the OU of the Apple Development certificate)");
  }

  await check("iPhone: the installed app opens on its catalog without clearing anything", async () => {
    const scenario: ScenarioSpec = {
      id: "phone-catalog",
      type: "mobile",
      steps: [
        { given: { op: "mobile.launch" } },
        { then: { op: "mobile.expectVisible", with: { locator: acc("Catalog-screen"), timeoutMs: 15000 } } },
      ],
    };
    const reporter = new ContentReporter();
    await runFromMetadata({ scenarios: [scenario], mobile: phoneApp(), reporter });
    assert.deepEqual(reporter.scenarioEnds, [{ id: "phone-catalog", ok: true }]);
  });

  await check("iPhone: a tap moves between screens (More tab, then the menu)", async () => {
    const scenario: ScenarioSpec = {
      id: "phone-menu",
      type: "mobile",
      steps: [
        { given: { op: "mobile.launch" } },
        { when: { op: "mobile.tap", with: { locator: acc("More-tab-item") } } },
        { then: { op: "mobile.expectVisible", with: { locator: acc("GeoLocation-menu-item"), timeoutMs: 15000 } } },
      ],
    };
    const reporter = new ContentReporter();
    await runFromMetadata({ scenarios: [scenario], mobile: phoneApp(), reporter });
    assert.deepEqual(reporter.scenarioEnds, [{ id: "phone-menu", ok: true }]);
  });

  await check("iPhone: clearData is refused with the reason, before the app is touched", async () => {
    const scenario: ScenarioSpec = {
      id: "phone-clear",
      type: "mobile",
      steps: [{ given: { op: "mobile.launch", with: { clearData: true } } }],
    };
    const reporter = new ContentReporter();
    await assert.rejects(
      runFromMetadata({ scenarios: [scenario], mobile: phoneApp(), reporter }),
      /Clearing data on an iPhone is not supported: Test Hub uses the app already installed on the phone/,
    );
  });

  await check("iPhone: a failing scenario keeps the recording and a device log with the app's own lines", async () => {
    const failing: ScenarioSpec = {
      id: "phone-fails",
      type: "mobile",
      steps: [
        { given: { op: "mobile.launch" } },
        { then: { op: "mobile.expectVisible", with: { locator: acc("does-not-exist"), timeoutMs: 3000 } } },
      ],
    };
    const reporter = new ContentReporter();
    await assert.rejects(
      runFromMetadata({ scenarios: [failing], mobile: phoneApp(), reporter }),
      /No element matches \{ by: "accessibilityId", value: "does-not-exist" \} after 3000 ms/,
    );
    assert.deepEqual(reporter.runArtifacts.map((a) => a.name), ["run.mp4"]);
    assert.ok(reporter.runArtifacts[0].bytes > 1000, "recording looks empty");
    const log = reporter.contents.get("phone-fails/console.json");
    assert.ok(log, "no console.json was attached");
    const entries = JSON.parse(log) as Array<{ type: string; text: string }>;
    const own = entries.filter((e) => e.text.includes(`${process.env.MOBILE_IT_IOS_PROCESS ?? "My Demo App"}`));
    assert.ok(own.length > 0, `the device log has no line from the app (${entries.length} lines kept)`);
    assert.ok(!entries.some((e) => e.text.includes("WebDriverAgentRunner-Runner")), "WebDriverAgent's own lines should be filtered out");
    console.log(`      ${entries.length} log lines kept, ${own.length} from the app; recording ${reporter.runArtifacts[0].bytes} bytes`);
  });
}

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
  if (IOS_DEVICE) {
    await iosDeviceChecks();
    const failedPhone = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failedPhone.length}/${results.length} checks passed`);
    process.exit(failedPhone.length ? 1 : 0);
  }
  if (IOS) {
    await iosChecks();
    const failedIos = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failedIos.length}/${results.length} checks passed`);
    process.exit(failedIos.length ? 1 : 0);
  }

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

  await check("a failing scenario still gets the recording, and no screenshot is uploaded", async () => {
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
    assert.ok(!names.includes("screenshot.png"), `screenshot.png should not be attached by default, got: ${names.join(", ")}`);
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
