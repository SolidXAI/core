import * as path from 'path';
import { MigrationError } from './migration-error';
import { getPrivateMediaStorageDir, getPublicMediaStorageDir } from 'src/services/file/media-storage-paths';
import { MEDIA_MIGRATION_KEY_MAX_LENGTH } from 'src/entities/media-migration-item.entity';
import { assertStorableKey, equivalentKeys, findTargetKeyCollisions, normalizeTargetKey, resolveLocation, sameLocation } from './media-location';

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
  it('turns an absolute path elsewhere on disk into its file name', () => {
    expect(normalizeTargetKey('/var/app/media-files-storage/abc.png')).toBe('abc.png');
  });

  it('keeps the part of an absolute path below the storage folders', () => {
    expect(normalizeTargetKey(`${getPublicMediaStorageDir()}/abc.png`)).toBe('abc.png');
    expect(normalizeTargetKey(`${getPrivateMediaStorageDir()}/2024/abc.png`)).toBe('2024/abc.png');
  });

  it('keeps other folders in the name, so files in different folders stay different', () => {
    expect(normalizeTargetKey('a/report.pdf')).toBe('a/report.pdf');
    expect(normalizeTargetKey('b/report.pdf')).toBe('b/report.pdf');
    expect(normalizeTargetKey('media-files-storage/a/report.pdf')).toBe('a/report.pdf');
  });

  it('refuses names that could leave the storage folder', () => {
    for (const bad of ['../etc/passwd', 'a/../../b.png', 'media-files-storage/../x.png', '']) {
      expect(() => normalizeTargetKey(bad)).toThrow(MigrationError);
    }
  });

  it('refuses names too long to record', () => {
    expect(() => normalizeTargetKey('a'.repeat(MEDIA_MIGRATION_KEY_MAX_LENGTH + 1))).toThrow(/longer than/);
    expect(() => normalizeTargetKey('a'.repeat(MEDIA_MIGRATION_KEY_MAX_LENGTH))).not.toThrow();
  });
});

describe('equivalentKeys', () => {
  it('lists every way a disk file can be written in a media row, so no user of the file is missed', () => {
    const location = resolveLocation(disk, 'x.png');
    const keys = equivalentKeys(location);
    expect(keys).toEqual(expect.arrayContaining(['x.png', 'media-files-storage/x.png', 'media-files-storage-private/x.png']));
    expect(keys).toContain(location.kind === 'disk' ? location.absolutePath : '');
  });

  it('uses just the key for S3', () => {
    expect(equivalentKeys(resolveLocation(s3, 'abc.png'))).toEqual(['abc.png']);
  });

  it('never misses a spelling that reaches the file, on either a public or a private provider', () => {
    const location = resolveLocation(disk, 'sub/x.png');
    const keys = equivalentKeys(location);
    const spellings = ['sub/x.png', 'media-files-storage/sub/x.png', 'media-files-storage-private/sub/x.png', location.kind === 'disk' ? location.absolutePath : ''];
    for (const provider of [disk, privateDisk]) {
      for (const spelling of spellings) {
        if (sameLocation(location, resolveLocation(provider, spelling))) {
          expect(keys).toContain(spelling);
        }
      }
    }
  });
});

describe('assertStorableKey', () => {
  it('reports an invalid key with a stable code', () => {
    expect(() => assertStorableKey('/abs.png')).toThrow(expect.objectContaining({ code: 'INVALID_FILE_KEY' }));
  });
});

describe('findTargetKeyCollisions', () => {
  it('finds different source files that would share one target name', () => {
    const collisions = findTargetKeyCollisions(['x.png', 'media-files-storage/x.png', 'media-files-storage-private/x.png', 'y.png']);
    expect(collisions).toEqual([
      { targetKey: 'x.png', sourceKeys: ['x.png', 'media-files-storage/x.png', 'media-files-storage-private/x.png'] },
    ]);
  });

  it('does not report files in different folders, repeated keys or invalid keys', () => {
    expect(findTargetKeyCollisions(['a/report.pdf', 'b/report.pdf', 'a/report.pdf', '../bad'])).toEqual([]);
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
