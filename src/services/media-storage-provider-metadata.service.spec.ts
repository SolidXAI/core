import { BadRequestException } from '@nestjs/common';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';

describe('MediaStorageProviderMetadataService location guard', () => {
  const s3Provider = { id: 7, name: 'aws-main', type: 'aws-s3', bucketName: 'bucket-a', region: 'ap-south-1', isPublic: true, signedUrlExpiry: 60 };

  let repo: any;
  let mediaCount: number;
  let service: MediaStorageProviderMetadataService;

  beforeEach(() => {
    mediaCount = 500;
    repo = {
      findOne: jest.fn().mockResolvedValue({ ...s3Provider }),
      preload: jest.fn().mockImplementation(async (dto: any) => ({ ...s3Provider, ...dto })),
      save: jest.fn().mockImplementation(async (entity: any) => entity),
      create: jest.fn().mockImplementation((dto: any) => dto),
    };
    const dataSource: any = { getRepository: () => ({ count: jest.fn().mockImplementation(async () => mediaCount) }) };
    service = new MediaStorageProviderMetadataService(repo, {} as any, dataSource);
  });

  describe('update', () => {
    it('rejects a bucket change when the provider has media, with the file count', async () => {
      const result = service.update(7, { bucketName: 'bucket-b' } as any);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(/has 500 media files.*bucketName from "bucket-a" to "bucket-b"/);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows a bucket change when the provider has no media', async () => {
      mediaCount = 0;
      await service.update(7, { bucketName: 'bucket-b' } as any);
      expect(repo.save).toHaveBeenCalled();
    });

    it('allows changing settings that do not move files', async () => {
      await service.update(7, { signedUrlExpiry: 120, isPublic: false } as any);
      expect(repo.save).toHaveBeenCalled();
    });

    it('allows a blank region when none is stored', async () => {
      repo.findOne.mockResolvedValue({ ...s3Provider, region: null });
      await service.update(7, { region: '' } as any);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('upsert (used by the seeder)', () => {
    it('keeps stored location values instead of throwing, but applies other changes', async () => {
      await service.upsert({ name: 'aws-main', type: 'aws-s3', bucketName: 'bucket-b', signedUrlExpiry: 120 });
      const saved = repo.save.mock.calls[0][0];
      expect(saved.bucketName).toBe('bucket-a');
      expect(saved.signedUrlExpiry).toBe(120);
    });

    it('applies seed values when the provider has no media', async () => {
      mediaCount = 0;
      await service.upsert({ name: 'aws-main', type: 'aws-s3', bucketName: 'bucket-b' });
      expect(repo.save.mock.calls[0][0].bucketName).toBe('bucket-b');
    });

    it('creates the provider when it does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.upsert({ name: 'new', type: 'aws-s3', bucketName: 'bucket-z' });
      expect(repo.create).toHaveBeenCalledWith({ name: 'new', type: 'aws-s3', bucketName: 'bucket-z' });
    });
  });
});
