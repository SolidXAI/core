import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';

export interface ProviderLocationChange {
  field: 'type' | 'bucketName' | 'region' | 'isPublic';
  from: unknown;
  to: unknown;
}

type ProviderLocationSettings = {
  type?: string | null;
  bucketName?: string | null;
  region?: string | null;
  isPublic?: boolean | null;
};

// Empty strings come from blank form fields and mean the same as "not set".
const blankToNull = (value: unknown) => (value === undefined || value === null || value === '' ? null : value);

// Matches how the app reads the flag: anything other than an explicit false is public.
const normalizeIsPublic = (value: unknown) => value !== false;

/**
 * Which settings decide where a provider's existing files are found depends on its type:
 * - filesystem: public and private files live in different folders, so isPublic matters.
 *   bucketName and region are unused.
 * - aws-s3: files live at bucket + key. isPublic only changes how URLs are built (signed or
 *   plain), so it does not move any file.
 */
function locationFieldsFor(type: string | null | undefined): ProviderLocationChange['field'][] {
  switch (type) {
    case MediaStorageProviderType.Filesystem:
      return ['isPublic'];
    case MediaStorageProviderType.AwsS3:
      return ['bucketName', 'region'];
    default:
      return ['bucketName', 'region', 'isPublic'];
  }
}

/**
 * Returns the settings in `incoming` that would move where existing files are found.
 * Only fields present in `incoming` are compared, so partial updates are not flagged.
 */
export function findProviderLocationChanges(
  existing: ProviderLocationSettings,
  incoming: Partial<ProviderLocationSettings>,
): ProviderLocationChange[] {
  // A different type is a different storage system, so every existing file would be lost.
  if (incoming.type !== undefined && incoming.type !== existing.type) {
    return [{ field: 'type', from: existing.type, to: incoming.type }];
  }

  const changes: ProviderLocationChange[] = [];
  for (const field of locationFieldsFor(existing.type)) {
    if (incoming[field] === undefined) {
      continue;
    }
    const same = field === 'isPublic'
      ? normalizeIsPublic(existing[field]) === normalizeIsPublic(incoming[field])
      : blankToNull(existing[field]) === blankToNull(incoming[field]);
    if (!same) {
      changes.push({ field, from: existing[field], to: incoming[field] });
    }
  }
  return changes;
}

export function describeProviderLocationChanges(changes: ProviderLocationChange[]): string {
  return changes.map(change => `${change.field} from "${change.from ?? ''}" to "${change.to ?? ''}"`).join(' and ');
}
