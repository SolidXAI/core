import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * The npm `playwright` package ships no install script, so `npm install` places the
 * JS module but never downloads the browser binary. These helpers fetch it on demand.
 */

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
 */
export async function ensureChromiumInstalled(): Promise<void> {
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

  const result = spawnSync(process.execPath, [cliPath, "install", "chromium"], {
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(
      `Failed to download Chromium: ${result.error.message}. ` +
        "Install it manually with: npx playwright install chromium",
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `Chromium download exited with code ${result.status}. ` +
        "Install it manually with: npx playwright install chromium",
    );
  }
}
