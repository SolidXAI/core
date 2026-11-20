import { describeProviderLocationChanges, findProviderLocationChanges } from './media-storage-provider-changes';

describe('findProviderLocationChanges', () => {
  const s3 = { type: 'aws-s3', bucketName: 'bucket-a', region: 'ap-south-1', isPublic: true };
  const disk = { type: 'filesystem', isPublic: true };

  it('flags a different type', () => {
    expect(findProviderLocationChanges(disk, { type: 'aws-s3' })).toEqual([
      { field: 'type', from: 'filesystem', to: 'aws-s3' },
    ]);
  });

  it('flags a bucket or region change on S3', () => {
    const changes = findProviderLocationChanges(s3, { bucketName: 'bucket-b', region: 'us-east-1' });
    expect(changes.map(c => c.field)).toEqual(['bucketName', 'region']);
  });

  it('does not flag isPublic on S3, since the object stays where it is', () => {
    expect(findProviderLocationChanges(s3, { isPublic: false })).toEqual([]);
  });

  it('flags isPublic on filesystem, since public and private use different folders', () => {
    expect(findProviderLocationChanges(disk, { isPublic: false })).toEqual([
      { field: 'isPublic', from: true, to: false },
    ]);
  });

  it('does not flag bucket or region on filesystem', () => {
    expect(findProviderLocationChanges(disk, { bucketName: 'x', region: 'y' })).toEqual([]);
  });

  it('treats a missing isPublic as public', () => {
    expect(findProviderLocationChanges({ type: 'filesystem', isPublic: null }, { isPublic: true })).toEqual([]);
    expect(findProviderLocationChanges({ type: 'filesystem' }, { isPublic: false })).toHaveLength(1);
  });

  it('treats blank strings and null as the same value', () => {
    const stored = { type: 'aws-s3', bucketName: 'bucket-a', region: null };
    expect(findProviderLocationChanges(stored, { region: '' })).toEqual([]);
  });

  it('ignores fields that are not sent', () => {
    expect(findProviderLocationChanges(s3, {})).toEqual([]);
    expect(findProviderLocationChanges(s3, { bucketName: undefined })).toEqual([]);
  });

  it('does not flag values that are unchanged', () => {
    expect(findProviderLocationChanges(s3, { type: 'aws-s3', bucketName: 'bucket-a', region: 'ap-south-1' })).toEqual([]);
  });

  it('describes changes for error messages', () => {
    const changes = findProviderLocationChanges(s3, { bucketName: 'bucket-b' });
    expect(describeProviderLocationChanges(changes)).toBe('bucketName from "bucket-a" to "bucket-b"');
  });
});
