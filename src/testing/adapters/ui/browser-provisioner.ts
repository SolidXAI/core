import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * The npm `playwright` package ships no install script, so `npm install` places the
 * JS module but never downloads the browser binary. These helpers fetch it on demand.
 */

let inFlight: Promise<void> | null = null;
let activeInstall: ChildProcess | null = null;

/**
 * Resolves Playwright's own CLI entry point.
 *
 * `require.resolve('playwright/cli.js')` fails with ERR_PACKAGE_PATH_NOT_EXPORTED because
 * `cli.js` is absent from Playwright's `exports` map, so we resolve `package.json` (which
 * is exported) and walk to its sibling.
 */
export function resolvePlaywrightCli(): string | null {
  try {
    const packageJsonPath = require.resolve("playwright/package.json");
    const cliPath = path.join(path.dirname(packageJsonPath), "cli.js");
    return fs.existsSync(cliPath) ? cliPath : null;
  } catch {
    return null;
  }
}

/** Playwright writes this file into a browser's folder as the very last step of installing it. */
const INSTALL_COMPLETE_MARKER = "INSTALLATION_COMPLETE";

/** Playwright keeps each browser in its own folder, such as `chromium-1228` or `chromium_headless_shell-1228`. */
const PLAYWRIGHT_BROWSER_DIRECTORY = /^chromium(_headless_shell)?-\d+$/;

/**
 * The browser folder that contains `executablePath`, or null when the executable does not sit
 * in a Playwright-style folder (for example a Chrome the operator pointed to).
 */
export function playwrightBrowserDirectory(executablePath: string): string | null {
  let dir = path.dirname(executablePath);
  while (dir !== path.dirname(dir)) {
    if (PLAYWRIGHT_BROWSER_DIRECTORY.test(path.basename(dir))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * True when the browser at `executablePath` is fully installed.
 *
 * The executable alone is not proof: Playwright extracts the archive file by file and writes
 * the completion marker last, so an interrupted install can leave the executable behind in a
 * broken browser. When the executable is in a Playwright browser folder we also require the
 * marker. Anywhere else there is no marker to expect, so the executable alone is enough.
 */
export function isBrowserInstallComplete(executablePath: string): boolean {
  if (!fs.existsSync(executablePath)) return false;
  const directory = playwrightBrowserDirectory(executablePath);
  if (!directory) return true;
  return hasInstallMarker(directory);
}

function hasInstallMarker(browserDirectory: string): boolean {
  return fs.existsSync(path.join(browserDirectory, INSTALL_COMPLETE_MARKER));
}

/** The part of Playwright's browsers.json that this file reads. */
export interface PlaywrightBrowsersJson {
  browsers?: Array<{ name: string; revision: string }>;
}

/**
 * Playwright's list of browser versions (`browsers.json`), read from the same install as the `playwright`
 * package. It is not in the package's exports map, so it is read as a file next to `package.json`, the same
 * way the CLI entry point is found. Null when it cannot be read.
 */
export function readPlaywrightBrowsersJson(): PlaywrightBrowsersJson | null {
  try {
    const playwrightPackage = require.resolve("playwright/package.json");
    const corePackage = require.resolve("playwright-core/package.json", { paths: [path.dirname(playwrightPackage)] });
    return JSON.parse(fs.readFileSync(path.join(path.dirname(corePackage), "browsers.json"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * The headless shell folder that belongs with the Chromium at `chromiumExecutable`, or null when it cannot be
 * worked out (a Chromium outside a Playwright folder, or a Playwright with no headless shell).
 *
 * UI runs launch Chromium headless by default, and Playwright serves a headless launch from this separate
 * browser, which `playwright install chromium` installs alongside Chromium.
 */
export function headlessShellDirectory(chromiumExecutable: string, browsersJson: PlaywrightBrowsersJson | null): string | null {
  const chromiumDirectory = playwrightBrowserDirectory(chromiumExecutable);
  const shell = browsersJson?.browsers?.find((browser) => browser.name === "chromium-headless-shell");
  if (!chromiumDirectory || !shell) return null;
  return path.join(path.dirname(chromiumDirectory), `chromium_headless_shell-${shell.revision}`);
}

/**
 * True when everything a UI run launches is fully installed: Chromium, and its headless shell when this
 * Playwright has one. Each is checked for its completion marker (see `isBrowserInstallComplete`).
 */
export function isChromiumBundleComplete(chromiumExecutable: string, browsersJson: PlaywrightBrowsersJson | null): boolean {
  if (!isBrowserInstallComplete(chromiumExecutable)) return false;
  const shellDirectory = headlessShellDirectory(chromiumExecutable, browsersJson);
  return shellDirectory === null || hasInstallMarker(shellDirectory);
}

/**
 * Asking Playwright for the executable path keeps us in step with PLAYWRIGHT_BROWSERS_PATH
 * and its per-version cache layout instead of second-guessing either.
 */
export async function isChromiumInstalled(): Promise<boolean> {
  try {
    const { chromium } = await import("playwright");
    return isChromiumBundleComplete(chromium.executablePath(), readPlaywrightBrowsersJson());
  } catch {
    return false;
  }
}

/**
 * Downloads Chromium unless it is already present. Only Chromium is fetched: it is the
 * sole browser PlaywrightAdapter launches.
 *
 * Concurrent callers share one download. This matters once a server warms the browser up
 * at boot while a test run may start before that finishes.
 */
export function ensureChromiumInstalled(): Promise<void> {
  if (!inFlight) {
    // Clearing on settle rather than caching the result lets a failed download be retried
    // by the next caller instead of poisoning the whole process lifetime.
    inFlight = installChromium().finally(() => {
      inFlight = null;
      activeInstall = null;
    });
  }
  return inFlight;
}

/**
 * Stops a download that is still running, so shutting down mid-install does not orphan the
 * child process against a half-written browser cache. A half-written browser has no completion
 * marker, so `isChromiumInstalled` reports it as missing and the next call repairs it.
 */
export function cancelChromiumInstall(): void {
  activeInstall?.kill("SIGTERM");
}

async function installChromium(): Promise<void> {
  if (await isChromiumInstalled()) return;

  const cliPath = resolvePlaywrightCli();
  if (!cliPath) {
    throw new Error(
      "Chromium is required for UI scenarios but the playwright package could not be resolved. " +
        "Install it in the API project with: npm install playwright",
    );
  }

  console.log(
    "Chromium is required for UI scenarios and is not installed yet. Downloading it now (~150MB, one time)...",
  );

  await new Promise<void>((resolve, reject) => {
    // Async spawn, never spawnSync: this also runs inside a live server during module init,
    // where a synchronous child would block the event loop for the whole download.
    const child = spawn(process.execPath, [cliPath, "install", "chromium"], {
      stdio: "inherit",
    });
    activeInstall = child;

    child.on("error", (error) =>
      reject(
        new Error(
          `Failed to download Chromium: ${error.message}. ` +
            "Install it manually with: npx playwright install chromium",
        ),
      ),
    );

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Chromium download ${signal ? `was stopped by ${signal}` : `exited with code ${code}`}. ` +
            "Install it manually with: npx playwright install chromium",
        ),
      );
    });
  });
}
