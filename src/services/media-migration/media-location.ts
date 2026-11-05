import * as path from 'path';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { MEDIA_MIGRATION_KEY_MAX_LENGTH } from 'src/entities/media-migration-item.entity';
import {
  getMediaStorageDirName,
  getPrivateMediaStorageDir,
  getPublicMediaStorageDir,
  resolveDiskMediaPath,
} from 'src/services/file/media-storage-paths';
import { MigrationError } from './migration-error';

export type MediaLocation =
  | { kind: 'disk'; absolutePath: string }
  | { kind: 's3'; bucket: string; key: string; region: string };

/**
 * Where a stored file lives for a provider. `relativeUri` is the stored name on the
 * provider; `defaultRegion` is used for S3 when the provider has no region of its own.
 */
export function resolveLocation(
  provider: Pick<MediaStorageProviderMetadata, 'name' | 'type' | 'bucketName' | 'region' | 'isPublic'>,
  relativeUri: string,
  defaultRegion?: string,
): MediaLocation {
  switch (provider.type as MediaStorageProviderType) {
    case MediaStorageProviderType.Filesystem:
      return { kind: 'disk', absolutePath: resolveDiskMediaPath(relativeUri, provider.isPublic !== false) };
    case MediaStorageProviderType.AwsS3: {
      if (!provider.bucketName) {
        throw new MigrationError('PROVIDER_MISCONFIGURED', `Provider "${provider.name}" has no bucketName set.`);
      }
      const region = provider.region || defaultRegion;
      if (!region) {
        throw new MigrationError('PROVIDER_MISCONFIGURED', `Provider "${provider.name}" has no region, and S3_AWS_REGION_NAME is not set.`);
      }
      return { kind: 's3', bucket: provider.bucketName, key: relativeUri, region };
    }
    default:
      throw new MigrationError('PROVIDER_MISCONFIGURED', `Provider "${provider.name}" has unsupported type "${provider.type}".`);
  }
}

// Removes the storage folder that older stored values carry, so the target provider decides the folder.
function stripStorageFolder(value: string): string {
  const normalized = value.replace(/\\/g, '/');

  if (path.isAbsolute(normalized)) {
    // Inside the media storage folders: keep the part below them. Anywhere else on disk,
    // only the file name can be kept.
    for (const root of [getPrivateMediaStorageDir(), getPublicMediaStorageDir()]) {
      const relative = path.relative(root, normalized);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
        return relative.split(path.sep).join('/');
      }
    }
    return path.basename(normalized);
  }

  const dirName = getMediaStorageDirName();
  for (const prefix of [`${dirName}-private/`, `${dirName}/`]) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }
  return normalized;
}

/**
 * Throws if a file key cannot be used safely: empty, too long to record, or able to leave the
 * storage folder (".." segments, a leading slash).
 */
export function assertStorableKey(key: string): void {
  const segments = key.split('/');
  if (!key || key.includes('\0') || key.startsWith('/') || segments.some(segment => segment === '..' || segment === '.' || segment === '')) {
    throw new MigrationError('INVALID_FILE_KEY', `"${key}" is not a valid file name for media storage.`);
  }
  if (key.length > MEDIA_MIGRATION_KEY_MAX_LENGTH) {
    throw new MigrationError('INVALID_FILE_KEY', `The file name "${key.slice(0, 60)}..." is longer than ${MEDIA_MIGRATION_KEY_MAX_LENGTH} characters and cannot be migrated.`);
  }
}

/**
 * The name a file gets on the target. Stored names normally have no folder, but older values may
 * carry the storage folder ("media-files-storage/x.png") or be absolute paths; that part is dropped
 * because the target provider decides the folder. Any other folder in the name is kept, so
 * "a/report.pdf" and "b/report.pdf" stay different files.
 *
 * Different source keys can still map to one target ("x.png" and "media-files-storage/x.png").
 * Use findTargetKeyCollisions to detect that before copying.
 */
export function normalizeTargetKey(relativeUri: string): string {
  const key = stripStorageFolder(relativeUri);
  assertStorableKey(key);
  return key;
}

/** Groups of different source keys that would be stored under the same target name. */
export function findTargetKeyCollisions(sourceKeys: Iterable<string>): { targetKey: string; sourceKeys: string[] }[] {
  const byTarget = new Map<string, Set<string>>();
  for (const sourceKey of sourceKeys) {
    let targetKey: string;
    try {
      targetKey = normalizeTargetKey(sourceKey);
    } catch {
      continue; // invalid keys are reported on their own
    }
    byTarget.set(targetKey, (byTarget.get(targetKey) ?? new Set()).add(sourceKey));
  }
  return [...byTarget.entries()]
    .filter(([, sources]) => sources.size > 1)
    .map(([targetKey, sources]) => ({ targetKey, sourceKeys: [...sources] }));
}

/** True when both locations point at the same stored object, so no copy is needed. */
export function sameLocation(a: MediaLocation, b: MediaLocation): boolean {
  if (a.kind === 'disk' && b.kind === 'disk') {
    return path.resolve(a.absolutePath) === path.resolve(b.absolutePath);
  }
  if (a.kind === 's3' && b.kind === 's3') {
    return a.bucket === b.bucket && a.key === b.key;
  }
  return false;
}
