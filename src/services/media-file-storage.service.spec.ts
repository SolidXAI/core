import { MediaFileStorageService } from './media-file-storage.service';

describe('MediaFileStorageService.deleteFile', () => {
  const disk = { id: 1, name: 'disk', type: 'filesystem', isPublic: true } as any;
  const s3 = { id: 2, name: 's3-a', type: 'aws-s3', bucketName: 'bucket-a', region: 'ap-south-1' } as any;
  const media = { id: 10, relativeUri: 'abc-photo.png' } as any;

  let diskFileService: any;
  let s3FileService: any;
  let mediaRepository: any;
  let service: MediaFileStorageService;

  beforeEach(() => {
    diskFileService = { delete: jest.fn().mockResolvedValue(undefined) };
    s3FileService = { delete: jest.fn().mockResolvedValue(undefined) };
    mediaRepository = { exists: jest.fn().mockResolvedValue(false) };
    const configService: any = { get: jest.fn() };
    service = new MediaFileStorageService(configService, diskFileService, s3FileService, {} as any, mediaRepository);
  });

  it('deletes a filesystem file from the disk', async () => {
    await expect(service.deleteFile(media, disk)).resolves.toBe(true);
    expect(diskFileService.delete).toHaveBeenCalledWith(expect.stringContaining('abc-photo.png'));
    expect(s3FileService.delete).not.toHaveBeenCalled();
  });

  it("deletes an S3 file from the row's own bucket and region", async () => {
    await expect(service.deleteFile(media, s3)).resolves.toBe(true);
    expect(s3FileService.delete).toHaveBeenCalledWith('bucket-a:abc-photo.png', { region: 'ap-south-1' });
    expect(diskFileService.delete).not.toHaveBeenCalled();
  });

  it('keeps the file while another row still uses it, such as a draft/publish version', async () => {
    mediaRepository.exists.mockResolvedValue(true);
    await expect(service.deleteFile(media, disk)).resolves.toBe(false);
    expect(diskFileService.delete).not.toHaveBeenCalled();
  });

  it('logs and returns false instead of throwing when storage fails', async () => {
    diskFileService.delete.mockRejectedValue(new Error('ENOENT'));
    await expect(service.deleteFile(media, disk)).resolves.toBe(false);
  });

  it('does nothing without a provider, an unknown provider type or a file name', async () => {
    await expect(service.deleteFile(media, undefined)).resolves.toBe(false);
    await expect(service.deleteFile(media, { type: 'azure-blob-storage' } as any)).resolves.toBe(false);
    await expect(service.deleteFile({ id: 11 } as any, disk)).resolves.toBe(false);
    expect(diskFileService.delete).not.toHaveBeenCalled();
    expect(s3FileService.delete).not.toHaveBeenCalled();
  });
});
