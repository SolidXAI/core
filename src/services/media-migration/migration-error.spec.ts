import { MigrationError, toMigrationError } from './migration-error';

describe('toMigrationError', () => {
  it('maps a missing S3 bucket', () => {
    const err = toMigrationError({ name: 'NoSuchBucket', message: 'x' }, 'target', 'bucket "b"');
    expect(err.code).toBe('BUCKET_NOT_FOUND');
  });

  it('reports a permission error as a read problem on the source and a write problem on the target', () => {
    expect(toMigrationError({ name: 'AccessDenied' }, 'source', 'a').code).toBe('SOURCE_READ_DENIED');
    expect(toMigrationError({ name: 'AccessDenied' }, 'target', 'a').code).toBe('TARGET_WRITE_DENIED');
    expect(toMigrationError({ code: 'EACCES', message: 'x' }, 'target', 'a').code).toBe('TARGET_WRITE_DENIED');
    expect(toMigrationError({ $metadata: { httpStatusCode: 403 } }, 'source', 'a').code).toBe('SOURCE_READ_DENIED');
  });

  it('maps a full disk', () => {
    expect(toMigrationError({ code: 'ENOSPC', message: 'x' }, 'target', 'a').code).toBe('DISK_FULL');
  });

  it('maps missing S3 credentials', () => {
    const err = toMigrationError(new Error('S3 Client not initialized. Please check the S3 configuration.'), 'target', 'a');
    expect(err.code).toBe('S3_CREDENTIALS_MISSING');
    expect(err.message).toContain('S3_AWS_ACCESS_KEY');
  });

  it('keeps an existing MigrationError as it is', () => {
    const original = new MigrationError('SIZE_MISMATCH', 'bad size');
    expect(toMigrationError(original, 'target', 'a')).toBe(original);
  });

  it('falls back to UNKNOWN and keeps the original message and subject', () => {
    const err = toMigrationError(new Error('boom'), 'target', 'file "a.png"');
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('boom (file "a.png")');
  });
});
