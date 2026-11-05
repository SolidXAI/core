import { BadRequestException } from '@nestjs/common';
import { MediaMigrationJob } from 'src/entities/media-migration-job.entity';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';

describe('MediaStorageProviderMetadataService location guard', () => {
  const s3Provider = { id: 7, name: 'aws-main', type: 'aws-s3', bucketName: 'bucket-a', region: 'ap-south-1', isPublic: true, signedUrlExpiry: 60 };

  let repo: any;
  let mediaCount: number;
  let jobCount: number;
  let service: MediaStorageProviderMetadataService;

  beforeEach(() => {
    mediaCount = 500;
    jobCount = 0;
    repo = {
      findOne: jest.fn().mockResolvedValue({ ...s3Provider }),
      preload: jest.fn().mockImplementation(async (dto: any) => ({ ...s3Provider, ...dto })),
      save: jest.fn().mockImplementation(async (entity: any) => entity),
      create: jest.fn().mockImplementation((dto: any) => dto),
    };
    const dataSource: any = {
      getRepository: (entity: unknown) => ({ count: jest.fn().mockImplementation(async () => (entity === MediaMigrationJob ? jobCount : mediaCount)) }),
    };
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

  describe('deleting a provider', () => {
    beforeEach(() => {
      repo.remove = jest.fn().mockImplementation(async (entity: any) => entity);
    });

    it('is refused with a clear message when migration jobs use the provider', async () => {
      jobCount = 3;
      const result = service.delete(7);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(/used by 3 media migration job\(s\)/);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('is refused for a bulk delete too', async () => {
      jobCount = 1;
      await expect(service.deleteMany([7, 8])).rejects.toThrow(/media migration job/);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('works when no migration job uses the provider', async () => {
      await service.delete(7);
      expect(repo.remove).toHaveBeenCalled();
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
