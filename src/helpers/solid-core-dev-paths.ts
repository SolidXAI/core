import * as fs from 'fs';
import * as path from 'path';

/**
 * Core-mode paths, set only by `solidctl … --core` on the spawned `solid` process.
 * When unset, every function returns undefined and callers keep today's behaviour.
 *
 * solidctl checks that this file exists in the installed core (dist/helpers/solid-core-dev-paths.js)
 * to know the installed core supports --core. Do not rename or move it.
 */
export const SOLIDX_CORE_REPO_ROOT_ENV = 'SOLIDX_CORE_REPO_ROOT';

export function getCoreRepoRoot(): string | undefined {
  const root = process.env[SOLIDX_CORE_REPO_ROOT_ENV]?.trim();
  return root ? path.resolve(root) : undefined;
}

/**
 * The code-builder collection installed for this project (solid-api/node_modules/@solidxai/code-builder).
 * This is the same copy `solidctl local-upgrade --code-builder` keeps up to date, so it is the single
 * source of truth for generation in both normal and core mode.
 */
export function getInstalledCodeBuilderCollection(): string {
  const packageJson = require.resolve('@solidxai/code-builder/package.json');
  const collection = path.join(path.dirname(packageJson), 'dist', 'collection.json');
  if (!fs.existsSync(collection)) {
    throw new Error(
      `The installed @solidxai/code-builder has no ${collection}. Run \`solidctl local-upgrade --code-builder\` first.`,
    );
  }
  return collection;
}

/** <core repo>/src/seeders/seed-data/solid-core-metadata.json in core mode, else undefined. */
export function getCoreRepoMetadataPath(): string | undefined {
  const root = getCoreRepoRoot();
  return root ? path.join(root, 'src', 'seeders', 'seed-data', 'solid-core-metadata.json') : undefined;
}
