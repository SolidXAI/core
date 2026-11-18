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
export const SOLIDX_CODE_BUILDER_ROOT_ENV = 'SOLIDX_CODE_BUILDER_ROOT';

export function getCoreRepoRoot(): string | undefined {
  const root = process.env[SOLIDX_CORE_REPO_ROOT_ENV]?.trim();
  return root ? path.resolve(root) : undefined;
}

export function getCodeBuilderRoot(): string | undefined {
  const root = process.env[SOLIDX_CODE_BUILDER_ROOT_ENV]?.trim();
  return root ? path.resolve(root) : undefined;
}

/** <code-builder>/dist/collection.json in core mode. Throws if core mode is on but it has not been built. */
export function getLocalCodeBuilderCollection(): string | undefined {
  const root = getCodeBuilderRoot();
  if (!root) return undefined;
  const collection = path.join(root, 'dist', 'collection.json');
  if (!fs.existsSync(collection)) {
    throw new Error(
      `Local code-builder is not built: ${collection} is missing. Run \`npm run build\` in ${root} first.`,
    );
  }
  return collection;
}

/** <core repo>/src/seeders/seed-data/solid-core-metadata.json in core mode, else undefined. */
export function getCoreRepoMetadataPath(): string | undefined {
  const root = getCoreRepoRoot();
  return root ? path.join(root, 'src', 'seeders', 'seed-data', 'solid-core-metadata.json') : undefined;
}
