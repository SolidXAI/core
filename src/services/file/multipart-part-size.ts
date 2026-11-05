const MiB = 1024 * 1024;

export const DEFAULT_MULTIPART_PART_SIZE = 8 * MiB;
// S3 allows at most 10,000 parts per upload. Stay below it so a size estimate that is slightly off still fits.
const MAX_PARTS = 9000;
const MAX_PART_SIZE = 5 * 1024 * MiB;

/**
 * Part size for a multipart upload. With a fixed 8 MiB part the upload would fail
 * above ~78 GiB, so when the total size is known the part size grows to keep the part count in range.
 */
export function chooseMultipartPartSize(totalBytes?: number): number {
  if (!totalBytes || totalBytes <= 0) {
    return DEFAULT_MULTIPART_PART_SIZE;
  }
  const roundedUpToMiB = Math.ceil(Math.ceil(totalBytes / MAX_PARTS) / MiB) * MiB;
  return Math.min(Math.max(DEFAULT_MULTIPART_PART_SIZE, roundedUpToMiB), MAX_PART_SIZE);
}
