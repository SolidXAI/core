#!/usr/bin/env node
/**
 * Optional eager download of the Chromium build Playwright needs for UI tests.
 *
 * The npm `playwright` package ships no install script of its own, so without this the
 * browser only arrives lazily on the first UI test run. Projects that would rather pay
 * that cost at install time set COMMON_UI_TEST_BROWSERS_EAGER_INSTALL=true, either as a
 * real environment variable or in the consuming project's .env.
 *
 * Off by default so trial installs and production deploys do not download a browser they
 * never launch. This must never fail an install, so every path exits 0.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FLAG = 'COMMON_UI_TEST_BROWSERS_EAGER_INSTALL';

/**
 * npm does not load .env files for install scripts, but every other COMMON_* setting lives
 * there, so we read it ourselves rather than silently ignoring the value. INIT_CWD is set by
 * npm to the directory the install was launched from, i.e. the consuming project root.
 */
function readFlagFromEnvFile() {
  const projectRoot = process.env.INIT_CWD;
  if (!projectRoot) return undefined;

  const envFilePath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envFilePath)) return undefined;

  const line = fs
    .readFileSync(envFilePath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${FLAG}=`));
  if (!line) return undefined;

  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

function main() {
  const flag = process.env[FLAG] ?? readFlagFromEnvFile();
  if (flag !== 'true') {
    return;
  }

  // cli.js is not in playwright's exports map, so resolve package.json and walk across.
  const packageJsonPath = require.resolve('playwright/package.json');
  const cliPath = path.join(path.dirname(packageJsonPath), 'cli.js');
  if (!fs.existsSync(cliPath)) {
    console.warn('[solidxai/core] Skipping Chromium download: playwright CLI not found.');
    return;
  }

  console.log('[solidxai/core] COMMON_UI_TEST_BROWSERS_EAGER_INSTALL is set, downloading Chromium...');
  const result = spawnSync(process.execPath, [cliPath, 'install', 'chromium'], {
    stdio: 'inherit',
  });

  if (result.error || result.status !== 0) {
    console.warn(
      '[solidxai/core] Chromium download did not complete. UI tests will fetch it on their first run.',
    );
  }
}

try {
  main();
} catch (error) {
  console.warn(`[solidxai/core] Skipping Chromium download: ${error && error.message}`);
}

process.exit(0);
