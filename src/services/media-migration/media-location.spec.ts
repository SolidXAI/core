import * as path from 'path';
import { MigrationError } from './migration-error';
import { normalizeTargetKey, resolveLocation, sameLocation } from './media-location';

const disk = { name: 'fs', type: 'filesystem', isPublic: true } as any;
const privateDisk = { name: 'fs-private', type: 'filesystem', isPublic: false } as any;
const s3 = { name: 's3-a', type: 'aws-s3', bucketName: 'bucket-a', region: 'ap-south-1' } as any;

describe('normalizeTargetKey', () => {
  it('keeps a plain stored name', () => {
    expect(normalizeTargetKey('abc.png')).toBe('abc.png');
  });
  it('strips a public or private folder prefix', () => {
    expect(normalizeTargetKey('media-files-storage/abc.png')).toBe('abc.png');
    expect(normalizeTargetKey('media-files-storage-private/abc.png')).toBe('abc.png');
  });
  it('turns an absolute path into its file name', () => {
    expect(normalizeTargetKey('/var/app/media-files-storage/abc.png')).toBe('abc.png');
  });
});

describe('resolveLocation', () => {
  it('puts public files in the public folder and private files in the private folder', () => {
    const pub = resolveLocation(disk, 'abc.png');
    const priv = resolveLocation(privateDisk, 'abc.png');
    expect(pub).toEqual({ kind: 'disk', absolutePath: expect.stringContaining(path.sep) });
    expect(pub.kind === 'disk' && pub.absolutePath).not.toEqual(priv.kind === 'disk' && priv.absolutePath);
  });

  it('uses the provider bucket and region for S3', () => {
    expect(resolveLocation(s3, 'abc.png')).toEqual({ kind: 's3', bucket: 'bucket-a', key: 'abc.png', region: 'ap-south-1' });
  });

  it('falls back to the default region when the provider has none', () => {
    expect(resolveLocation({ ...s3, region: null }, 'abc.png', 'us-east-1')).toMatchObject({ region: 'us-east-1' });
  });

  it('reports a misconfigured S3 provider with a clear code', () => {
    expect(() => resolveLocation({ ...s3, bucketName: null }, 'abc.png')).toThrow(MigrationError);
    expect(() => resolveLocation({ ...s3, region: null }, 'abc.png')).toThrow(/no region/);
  });

  it('rejects an unsupported provider type', () => {
    expect(() => resolveLocation({ name: 'az', type: 'azure-blob-storage' } as any, 'abc.png')).toThrow(/unsupported type/);
  });
});

describe('sameLocation', () => {
  it('treats the same S3 bucket and key as the same location, whatever the region or publicity', () => {
    const a = resolveLocation(s3, 'abc.png');
    expect(sameLocation(a, resolveLocation({ ...s3, region: 'us-east-1' }, 'abc.png'))).toBe(true);
  });
  it('treats different buckets or keys as different', () => {
    const a = resolveLocation(s3, 'abc.png');
    expect(sameLocation(a, resolveLocation({ ...s3, bucketName: 'bucket-b' }, 'abc.png'))).toBe(false);
    expect(sameLocation(a, resolveLocation(s3, 'other.png'))).toBe(false);
  });
  it('never treats disk and S3 as the same', () => {
    expect(sameLocation(resolveLocation(disk, 'abc.png'), resolveLocation(s3, 'abc.png'))).toBe(false);
  });
});
