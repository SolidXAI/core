import { MediaDownloadUrlService } from './media-download-url.service';

// Each media row's link is built from the provider recorded on that row, not the field's provider.
describe('MediaDownloadUrlService.buildFullUrl', () => {
  const disk = { id: 1, name: 'fs', type: 'filesystem', isPublic: true } as any;
  const privateDisk = { id: 2, name: 'fs-private', type: 'filesystem', isPublic: false } as any;
  const s3 = { id: 3, name: 's3', type: 'aws-s3', bucketName: 'bucket-a', region: 'ap-south-1', isPublic: true, signedUrlExpiry: 60 } as any;
  const privateS3 = { ...s3, id: 4, isPublic: false, signedUrlExpiry: 30 };

  let jwtService: any;
  let s3FileService: any;
  let diskFileService: any;
  let settingService: any;
  let service: MediaDownloadUrlService;

  beforeEach(() => {
    jwtService = { signAsync: jest.fn(async () => 'signed-token') };
    s3FileService = { getUrl: jest.fn(async (path: string) => `https://s3/${path}`) };
    diskFileService = { getUrl: jest.fn(async (path: string) => `/disk/${path}`) };
    settingService = { getConfigValue: jest.fn((key: string) => (key === 'baseUrl' ? 'https://app.example/' : 'secret')) };
    service = new MediaDownloadUrlService(jwtService, s3FileService, diskFileService, settingService, { get: () => 'ap-south-1' } as any);
  });

  it('builds a disk link for a public filesystem row', async () => {
    const url = await service.buildFullUrl({ id: 10, relativeUri: 'a.png', mediaStorageProviderMetadata: disk } as any);
    expect(url).toContain('a.png');
    expect(diskFileService.getUrl).toHaveBeenCalledTimes(1);
    expect(s3FileService.getUrl).not.toHaveBeenCalled();
  });

  it('builds an S3 link from the row\'s own bucket, even when the field points elsewhere', async () => {
    const url = await service.buildFullUrl({ id: 11, relativeUri: 'b.png', mediaStorageProviderMetadata: s3 } as any);
    expect(url).toBe('https://s3/bucket-a:b.png');
    expect(s3FileService.getUrl).toHaveBeenCalledWith('bucket-a:b.png', expect.objectContaining({ expiresIn: 0 }));
  });

  it('gives a signed S3 link with the provider\'s expiry for a private S3 row', async () => {
    await service.buildFullUrl({ id: 12, relativeUri: 'c.png', mediaStorageProviderMetadata: privateS3 } as any);
    expect(s3FileService.getUrl).toHaveBeenCalledWith('bucket-a:c.png', expect.objectContaining({ expiresIn: 30 * 60 }));
  });

  it('gives an app-served token link for a private filesystem row', async () => {
    const url = await service.buildFullUrl({ id: 13, relativeUri: 'd.png', mediaStorageProviderMetadata: privateDisk } as any);
    expect(url).toBe('https://app.example/api/media/13/download?token=signed-token');
    expect(diskFileService.getUrl).not.toHaveBeenCalled();
  });

  it('keeps a mixed field correct: each row uses its own provider', async () => {
    const rows = [
      { id: 1, relativeUri: 'f1.png', mediaStorageProviderMetadata: disk },
      { id: 2, relativeUri: 'f2.png', mediaStorageProviderMetadata: s3 },
    ] as any[];
    const urls = await Promise.all(rows.map(row => service.buildFullUrl(row)));
    expect(urls[0]).toContain('f1.png');
    expect(urls[1]).toBe('https://s3/bucket-a:f2.png');
  });

  it('returns the stored name, with a warning, for a row with no provider or an unknown type', async () => {
    expect(await service.buildFullUrl({ id: 3, relativeUri: 'x.png' } as any)).toBe('x.png');
    expect(await service.buildFullUrl({ id: 4, relativeUri: 'y.png', mediaStorageProviderMetadata: { type: 'azure-blob-storage' } } as any)).toBe('y.png');
  });
});
