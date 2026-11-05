import { ERROR_MESSAGES } from 'src/constants/error-messages';

export type MigrationErrorCode =
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_READ_DENIED'
  | 'TARGET_WRITE_DENIED'
  | 'TARGET_KEY_CONFLICT'
  | 'SIZE_MISMATCH'
  | 'BUCKET_NOT_FOUND'
  | 'DISK_FULL'
  | 'PROVIDER_MISCONFIGURED'
  | 'INVALID_FILE_KEY'
  | 'DELETE_DENIED'
  | 'S3_CREDENTIALS_MISSING'
  | 'ROW_DELETED_DURING_MIGRATION'
  | 'UNKNOWN';

/** An error with a stable code and a message an admin can act on. */
export class MigrationError extends Error {
  constructor(readonly code: MigrationErrorCode, message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'MigrationError';
  }
}

export type StorageRole = 'source' | 'target';
export type StorageOperation = 'read' | 'write' | 'delete';

/**
 * Turns a failure from the disk or S3 layer into a MigrationError.
 * `role` decides whether a permission error means the source could not be read or the
 * target could not be written (or, for operation "delete", that deleting is not allowed).
 * `subject` is a readable description of the file or bucket.
 */
export function toMigrationError(
  error: unknown,
  role: StorageRole,
  subject: string,
  operation: StorageOperation = role === 'source' ? 'read' : 'write',
): MigrationError {
  if (error instanceof MigrationError) {
    return error;
  }

  const err = error as any;
  const message: string = err?.message ?? String(error);

  if (message === ERROR_MESSAGES.S3_CLIENT_NOT_INITIALIZED) {
    return new MigrationError(
      'S3_CREDENTIALS_MISSING',
      'S3_AWS_ACCESS_KEY and S3_AWS_SECRET_KEY must be set to migrate to or from S3.',
      error,
    );
  }
  if (err?.name === 'NoSuchBucket') {
    return new MigrationError('BUCKET_NOT_FOUND', `Bucket for ${subject} does not exist. Check the bucket name and region.`, error);
  }
  if (err?.name === 'AccessDenied' || err?.$metadata?.httpStatusCode === 403 || err?.code === 'EACCES') {
    if (operation === 'delete') {
      return new MigrationError('DELETE_DENIED', `Cannot delete ${subject}: access denied. Check the provider's permissions allow deleting files (for S3, s3:DeleteObject).`, error);
    }
    return role === 'source'
      ? new MigrationError('SOURCE_READ_DENIED', `Cannot read ${subject}: access denied. Check the permissions for the source provider.`, error)
      : new MigrationError('TARGET_WRITE_DENIED', `Cannot write ${subject}: access denied. Check the permissions for the target provider.`, error);
  }
  if (err?.code === 'ENOSPC') {
    return new MigrationError('DISK_FULL', `No disk space left while writing ${subject}.`, error);
  }
  return new MigrationError('UNKNOWN', `${message} (${subject})`, error);
}
