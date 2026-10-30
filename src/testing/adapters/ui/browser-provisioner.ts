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

/**
 * Asking Playwright for the executable path keeps us in step with PLAYWRIGHT_BROWSERS_PATH
 * and its per-version cache layout instead of second-guessing either.
 */
export async function isChromiumInstalled(): Promise<boolean> {
  try {
    const { chromium } = await import("playwright");
    return fs.existsSync(chromium.executablePath());
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
 * child process against a half-written browser cache.
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
