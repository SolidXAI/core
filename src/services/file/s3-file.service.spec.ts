import { Readable } from 'stream';

const uploadOptions: any[] = [];
jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation((options: any) => {
    uploadOptions.push(options);
    return { done: jest.fn().mockResolvedValue({}) };
  }),
}));

import { S3FileService } from './s3-file.service';

const GiB = 1024 * 1024 * 1024;

describe('S3FileService', () => {
  let send: jest.Mock;
  let service: S3FileService;

  beforeEach(() => {
    uploadOptions.length = 0;
    send = jest.fn();
    service = new S3FileService();
    // Fake credentials and client so no real AWS call is possible.
    (service as any).accessKey = 'test';
    (service as any).secretKey = 'test';
    (service as any).s3ClientCache.set('ap-south-1', { send });
  });

  describe('bucketExists', () => {
    const options = { region: 'ap-south-1' };

    it('is true when the bucket answers', async () => {
      send.mockResolvedValue({});
      await expect(service.bucketExists('a', options)).resolves.toBe(true);
    });

    it('is false when the bucket is missing or in another region', async () => {
      send.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      send.mockRejectedValueOnce({ name: 'PermanentRedirect', $metadata: { httpStatusCode: 301 } });
      await expect(service.bucketExists('a', options)).resolves.toBe(false);
      await expect(service.bucketExists('a', options)).resolves.toBe(false);
    });

    it('throws permission errors instead of calling the bucket missing', async () => {
      send.mockRejectedValue({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
      await expect(service.bucketExists('a', options)).rejects.toMatchObject({ name: 'AccessDenied' });
    });
  });

  describe('writeStream part size', () => {
    const write = (contentLength?: number) =>
      service.writeStream('bucket:key', Readable.from([Buffer.from('x')]), { region: 'ap-south-1', contentLength });

    it('uses 8 MiB parts when the size is unknown', async () => {
      await write();
      expect(uploadOptions[0].partSize).toBe(8 * 1024 * 1024);
    });

    it('uses larger parts for very large files so the upload stays within 10,000 parts', async () => {
      await write(200 * GiB);
      expect(uploadOptions[0].partSize).toBeGreaterThan(8 * 1024 * 1024);
      expect(Math.ceil((200 * GiB) / uploadOptions[0].partSize)).toBeLessThanOrEqual(10000);
    });
  });
});
