import { Readable } from 'stream';
import { CommonEntity } from 'src/entities/common.entity';
import { FileS3StorageProvider } from './file-s3-storage-provider';

describe('FileS3StorageProvider uploads', () => {
  const provider = { id: 2, type: 'aws-s3', bucketName: 'bucket-a', region: 'ap-south-1' };
  const field: any = { id: 5, model: { id: 3 }, mediaStorageProvider: provider };
  const entity = Object.assign(Object.create(CommonEntity.prototype), { id: 42 });

  let s3FileService: any;
  let diskFileService: any;
  let mediaRepository: any;
  let uploaded: Buffer[];
  let target: FileS3StorageProvider<any>;

  beforeEach(() => {
    uploaded = [];
    s3FileService = {
      // Consume the stream like the real uploader does.
      writeStream: jest.fn().mockImplementation(async (_path: string, stream: Readable) => {
        for await (const chunk of stream) uploaded.push(Buffer.from(chunk));
      }),
      stat: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    diskFileService = {
      readStream: jest.fn().mockResolvedValue(Readable.from([Buffer.from('disk-file')])),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    mediaRepository = { createMedia: jest.fn().mockImplementation(async (input: any) => ({ id: 1, ...input })) };
    const configService: any = { get: jest.fn() };
    target = new FileS3StorageProvider(configService, diskFileService, s3FileService, mediaRepository, {} as any, {} as any);
  });

  describe('storeStreams', () => {
    it('records the byte count from the stream without asking S3 for the size', async () => {
      const stream = Readable.from([Buffer.from('hello '), Buffer.from('world')]);
      const [media] = await target.storeStreams([[stream, 'a.txt', { mimeType: 'text/plain' }]], entity, field);

      expect(Buffer.concat(uploaded).toString()).toBe('hello world');
      expect(media.fileSize).toBe(11);
      expect(s3FileService.stat).not.toHaveBeenCalled();
    });

    it('removes the uploaded object if the media row cannot be saved', async () => {
      mediaRepository.createMedia.mockRejectedValue(new Error('db down'));
      await expect(target.storeStreams([[Readable.from([Buffer.from('x')]), 'a.txt']], entity, field)).rejects.toThrow('db down');
      expect(s3FileService.delete).toHaveBeenCalledWith('bucket-a:a.txt', { region: 'ap-south-1' });
    });

    it('still reports the original error if cleanup also fails', async () => {
      mediaRepository.createMedia.mockRejectedValue(new Error('db down'));
      s3FileService.delete.mockRejectedValue(new Error('access denied'));
      await expect(target.storeStreams([[Readable.from([Buffer.from('x')]), 'a.txt']], entity, field)).rejects.toThrow('db down');
    });
  });

  describe('store', () => {
    it('streams the temp file to S3 instead of reading it into memory', async () => {
      const file: any = { path: '/tmp/up/abc', filename: 'abc', originalname: 'doc.pdf', mimetype: 'application/pdf', size: 9 };
      const [media] = await target.store([file], entity, field);

      expect(diskFileService.readStream).toHaveBeenCalledWith('/tmp/up/abc');
      expect(Buffer.concat(uploaded).toString()).toBe('disk-file');
      expect(diskFileService.delete).toHaveBeenCalledWith('/tmp/up/abc');
      expect(media.fileSize).toBe(9);
    });
  });
});
