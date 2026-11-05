import * as path from 'path';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { resolveDiskMediaPath } from 'src/services/file/media-storage-paths';
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

/**
 * The name a file gets on the target. Stored names never contain folders, but older values
 * may carry one ("media-files-storage/x.png", "media-files-storage-private/x.png") or be
 * absolute paths. Only the file name is kept, so the folder choice comes from the target provider.
 */
export function normalizeTargetKey(relativeUri: string): string {
  return path.basename(relativeUri.replace(/\\/g, '/'));
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
