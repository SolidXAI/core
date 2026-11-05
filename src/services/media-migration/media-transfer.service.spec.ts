import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { MediaTransferService } from './media-transfer.service';
import { MediaLocation } from './media-location';

// Real files are used for disk copies. They live in a temporary folder inside the repo
// (not the system temp dir) and are removed after the tests.
const workDir = path.join(process.cwd(), '.media-migration-test-tmp');

const diskAt = (name: string): Extract<MediaLocation, { kind: 'disk' }> => ({ kind: 'disk', absolutePath: path.join(workDir, name) });
const s3At = (bucket: string, key: string): Extract<MediaLocation, { kind: 's3' }> => ({ kind: 's3', bucket, key, region: 'r' });
const fsError = (code: string, filePath?: string) => Object.assign(new Error(`${code}: failed`), { code, syscall: 'open', path: filePath });
const consume = async (_path: string, stream: Readable) => { for await (const chunk of stream) { void chunk; } return 'url'; };

describe('MediaTransferService', () => {
  let diskFileService: any;
  let s3FileService: any;
  let service: MediaTransferService;

  beforeAll(() => fs.mkdirSync(workDir, { recursive: true }));
  afterAll(() => fs.rmSync(workDir, { recursive: true, force: true }));

  beforeEach(() => {
    diskFileService = {
      stat: jest.fn(async (p: string) => (fs.existsSync(p) ? { size: fs.statSync(p).size } : null)),
      write: jest.fn(async (p: string, data: Buffer) => fs.writeFileSync(p, data)),
      writeStream: jest.fn(async (p: string, stream: NodeJS.ReadableStream) => {
        await new Promise<void>((resolve, reject) => {
          const out = fs.createWriteStream(p);
          stream.pipe(out).on('finish', () => resolve()).on('error', reject);
        });
        return p;
      }),
      delete: jest.fn(async (p: string) => fs.unlinkSync(p)),
    };
    s3FileService = {
      stat: jest.fn(async () => null),
      write: jest.fn(async () => 'url'),
      writeStream: jest.fn(async () => 'url'),
      readStream: jest.fn(),
      copy: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      bucketExists: jest.fn(async () => true),
    };
    service = new MediaTransferService(diskFileService, s3FileService);
  });

  describe('copy', () => {
    it('copies a file on disk with the same content and leaves no temporary file behind', async () => {
      const src = diskAt('src.txt');
      fs.writeFileSync(src.absolutePath, 'hello');
      const dst = diskAt('nested/dst.txt');

      await service.copy(src, dst, { sourceSize: 5 });

      expect(fs.readFileSync(dst.absolutePath, 'utf8')).toBe('hello');
      expect(fs.readdirSync(path.dirname(dst.absolutePath)).filter(f => f.includes('migrating'))).toEqual([]);
    });

    it('reports a missing source file as SOURCE_NOT_FOUND and leaves nothing behind', async () => {
      const dst = diskAt('failed.txt');

      await expect(service.copy(diskAt('missing.txt'), dst, { sourceSize: 1 })).rejects.toMatchObject({ code: 'SOURCE_NOT_FOUND' });
      expect(fs.existsSync(dst.absolutePath)).toBe(false);
      expect(fs.readdirSync(workDir).filter(f => f.includes('migrating'))).toEqual([]);
    });

    it('copies small S3 objects with a single server-side copy', async () => {
      await service.copy(s3At('a', 'x.png'), s3At('b', 'x.png'), { sourceSize: 1024 });

      expect(s3FileService.copy).toHaveBeenCalledWith('a:x.png', 'b:x.png', { region: 'r' });
      expect(s3FileService.readStream).not.toHaveBeenCalled();
    });

    it('streams S3 objects larger than 5 GB and passes the size so the upload can size its parts', async () => {
      s3FileService.readStream.mockResolvedValue(fs.createReadStream(__filename));
      const size = 6 * 1024 * 1024 * 1024;

      await service.copy(s3At('a', 'big.mp4'), s3At('b', 'big.mp4'), { sourceSize: size });

      expect(s3FileService.copy).not.toHaveBeenCalled();
      expect(s3FileService.writeStream).toHaveBeenCalledWith('b:big.mp4', expect.anything(), { region: 'r', contentType: undefined, contentLength: size });
    });

    it('passes the file size when uploading from disk', async () => {
      const src = diskAt('upload.txt');
      fs.writeFileSync(src.absolutePath, 'abc');
      s3FileService.writeStream.mockImplementation(consume);

      await service.copy(src, s3At('b', 'upload.txt'), { sourceSize: 3, contentType: 'text/plain' });

      expect(s3FileService.writeStream).toHaveBeenCalledWith('b:upload.txt', expect.anything(), { region: 'r', contentType: 'text/plain', contentLength: 3 });
    });
  });

  describe('copy errors point at the side that failed', () => {
    it('disk to S3: an unreadable source file is a source problem', async () => {
      s3FileService.writeStream.mockImplementation(consume);
      await expect(service.copy(diskAt('nope.txt'), s3At('b', 'k'), { sourceSize: 1 })).rejects.toMatchObject({ code: 'SOURCE_NOT_FOUND' });
    });

    it('disk to S3: an S3 write error is a target problem', async () => {
      const src = diskAt('ok.txt');
      fs.writeFileSync(src.absolutePath, 'x');
      s3FileService.writeStream.mockRejectedValue({ name: 'AccessDenied' });
      await expect(service.copy(src, s3At('b', 'k'), { sourceSize: 1 })).rejects.toMatchObject({ code: 'TARGET_WRITE_DENIED' });
    });

    it('S3 to disk: a read error from S3 is a source problem', async () => {
      s3FileService.readStream.mockRejectedValue({ name: 'AccessDenied' });
      await expect(service.copy(s3At('a', 'k'), diskAt('out.txt'), { sourceSize: 1 })).rejects.toMatchObject({ code: 'SOURCE_READ_DENIED' });
    });

    it('S3 to disk: a missing S3 object is SOURCE_NOT_FOUND', async () => {
      s3FileService.readStream.mockRejectedValue({ name: 'NoSuchKey' });
      await expect(service.copy(s3At('a', 'k'), diskAt('out.txt'), { sourceSize: 1 })).rejects.toMatchObject({ code: 'SOURCE_NOT_FOUND' });
    });

    it('S3 to disk: a full disk is a target problem', async () => {
      s3FileService.readStream.mockResolvedValue(Readable.from([Buffer.from('x')]));
      diskFileService.writeStream.mockRejectedValue(fsError('ENOSPC'));
      await expect(service.copy(s3At('a', 'k'), diskAt('out.txt'), { sourceSize: 1 })).rejects.toMatchObject({ code: 'DISK_FULL' });
    });

    describe('S3 to S3 (the failing side is not in the error, so the source is checked)', () => {
      beforeEach(() => s3FileService.copy.mockRejectedValue({ name: 'AccessDenied' }));
      const run = () => service.copy(s3At('a', 'k'), s3At('b', 'k'), { sourceSize: 1 });

      it('is a target problem when the source can be read', async () => {
        s3FileService.stat.mockResolvedValue({ size: 1 });
        await expect(run()).rejects.toMatchObject({ code: 'TARGET_WRITE_DENIED' });
      });

      it('is a source problem when the source cannot be read', async () => {
        s3FileService.stat.mockRejectedValue({ name: 'AccessDenied' });
        await expect(run()).rejects.toMatchObject({ code: 'SOURCE_READ_DENIED' });
      });

      it('is SOURCE_NOT_FOUND when the source is gone', async () => {
        s3FileService.stat.mockResolvedValue(null);
        await expect(run()).rejects.toMatchObject({ code: 'SOURCE_NOT_FOUND' });
      });
    });
  });

  describe('streams are always released', () => {
    it('destroys the source stream when the upload fails before reading it', async () => {
      const src = diskAt('left-open.txt');
      fs.writeFileSync(src.absolutePath, 'x');
      let seen: Readable | undefined;
      s3FileService.writeStream.mockImplementation(async (_p: string, stream: Readable) => {
        seen = stream;
        throw { name: 'AccessDenied' };
      });

      await expect(service.copy(src, s3At('b', 'k'), { sourceSize: 1 })).rejects.toBeDefined();
      expect(seen?.destroyed).toBe(true);
    });

    it('does not crash on a stream error when the upload fails first', async () => {
      s3FileService.writeStream.mockRejectedValue(new Error('S3 Client not initialized. Please check the S3 configuration.'));

      await expect(service.copy(diskAt('also-missing.txt'), s3At('b', 'k'), { sourceSize: 1 })).rejects.toMatchObject({ code: 'S3_CREDENTIALS_MISSING' });
      // let the source stream's own error event fire; without a listener it would be an uncaught exception
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
    });

    it('destroys the S3 body when the disk write fails', async () => {
      const body = Readable.from([Buffer.from('x')]);
      s3FileService.readStream.mockResolvedValue(body);
      diskFileService.writeStream.mockRejectedValue(fsError('EACCES'));

      await expect(service.copy(s3At('a', 'k'), diskAt('out.txt'), { sourceSize: 1 })).rejects.toBeDefined();
      expect(body.destroyed).toBe(true);
    });
  });

  describe('sameContent', () => {
    it('is true for identical files and false for different files of the same size', async () => {
      fs.writeFileSync(diskAt('same-a.txt').absolutePath, 'abcd');
      fs.writeFileSync(diskAt('same-b.txt').absolutePath, 'abcd');
      fs.writeFileSync(diskAt('same-c.txt').absolutePath, 'abce');

      await expect(service.sameContent(diskAt('same-a.txt'), diskAt('same-b.txt'))).resolves.toBe(true);
      await expect(service.sameContent(diskAt('same-a.txt'), diskAt('same-c.txt'))).resolves.toBe(false);
    });

    it('compares a disk file with an S3 object', async () => {
      fs.writeFileSync(diskAt('s3-compare.txt').absolutePath, 'abcd');
      s3FileService.readStream.mockImplementation(async () => Readable.from([Buffer.from('ab'), Buffer.from('cd')]));
      await expect(service.sameContent(diskAt('s3-compare.txt'), s3At('b', 'k'))).resolves.toBe(true);

      s3FileService.readStream.mockImplementation(async () => Readable.from([Buffer.from('xxxx')]));
      await expect(service.sameContent(diskAt('s3-compare.txt'), s3At('b', 'k'))).resolves.toBe(false);
    });

    it('reports a read problem on the side that failed', async () => {
      s3FileService.readStream.mockRejectedValue({ name: 'AccessDenied' });
      fs.writeFileSync(diskAt('s3-denied.txt').absolutePath, 'x');
      await expect(service.sameContent(diskAt('s3-denied.txt'), s3At('b', 'k'))).rejects.toMatchObject({ code: 'TARGET_WRITE_DENIED' });
      await expect(service.sameContent(s3At('a', 'k'), diskAt('s3-denied.txt'))).rejects.toMatchObject({ code: 'SOURCE_READ_DENIED' });
    });
  });

  describe('assertBucketReachable', () => {
    it('passes for a bucket that exists and ignores disk locations', async () => {
      await expect(service.assertBucketReachable(s3At('a', 'k'), 'source')).resolves.toBeUndefined();
      await expect(service.assertBucketReachable(diskAt('x'), 'source')).resolves.toBeUndefined();
      expect(s3FileService.bucketExists).toHaveBeenCalledTimes(1);
    });

    it('reports a missing bucket once, instead of every file being "not found"', async () => {
      s3FileService.bucketExists.mockResolvedValue(false);
      await expect(service.assertBucketReachable(s3At('typo-bucket', 'k'), 'source')).rejects.toMatchObject({
        code: 'BUCKET_NOT_FOUND',
        message: expect.stringContaining('typo-bucket'),
      });
    });

    it('reports a permission problem on the right side', async () => {
      s3FileService.bucketExists.mockRejectedValue({ name: 'AccessDenied' });
      await expect(service.assertBucketReachable(s3At('a', 'k'), 'source')).rejects.toMatchObject({ code: 'SOURCE_READ_DENIED' });
      await expect(service.assertBucketReachable(s3At('a', 'k'), 'target')).rejects.toMatchObject({ code: 'TARGET_WRITE_DENIED' });
    });
  });

  describe('delete', () => {
    it('succeeds when a disk file is already gone, so cleanup can be re-run', async () => {
      diskFileService.delete.mockRejectedValue(fsError('ENOENT'));
      await expect(service.delete(diskAt('gone.txt'))).resolves.toBeUndefined();
    });

    it('reports a permission error as DELETE_DENIED whichever side it is', async () => {
      s3FileService.delete.mockRejectedValue({ name: 'AccessDenied' });
      await expect(service.delete(s3At('a', 'k'), 'source')).rejects.toMatchObject({ code: 'DELETE_DENIED' });
      await expect(service.delete(s3At('a', 'k'), 'target')).rejects.toMatchObject({ code: 'DELETE_DENIED' });
    });

    it('still reports other disk errors', async () => {
      diskFileService.delete.mockRejectedValue(fsError('EBUSY'));
      await expect(service.delete(diskAt('busy.txt'))).rejects.toMatchObject({ code: 'UNKNOWN' });
    });
  });

  describe('probeWritable', () => {
    const target = s3At('b', 'x.png');
    const probeStat = (size: number) => async (p: string) => (p.startsWith('b:.solidx-migration-probe-') ? { size } : null);

    it('writes, reads back and removes a small test file', async () => {
      s3FileService.stat.mockImplementation(probeStat(1));

      await service.probeWritable(target);

      expect(s3FileService.write).toHaveBeenCalledWith(expect.stringMatching(/^b:\.solidx-migration-probe-/), expect.any(Buffer), { region: 'r' });
      expect(s3FileService.delete).toHaveBeenCalledWith(expect.stringMatching(/^b:\.solidx-migration-probe-/), { region: 'r' });
    });

    it('fails when files can be written but not deleted, and names the file left behind', async () => {
      s3FileService.stat.mockImplementation(probeStat(1));
      s3FileService.delete.mockRejectedValue({ name: 'AccessDenied' });

      const result = service.probeWritable(target);

      await expect(result).rejects.toMatchObject({ code: 'DELETE_DENIED' });
      await expect(result).rejects.toThrow(/\.solidx-migration-probe-.* was left behind/);
    });

    it('reports a failed write as a target problem without trying to delete anything', async () => {
      s3FileService.write.mockRejectedValue({ name: 'AccessDenied' });

      await expect(service.probeWritable(target)).rejects.toMatchObject({ code: 'TARGET_WRITE_DENIED' });
      expect(s3FileService.delete).not.toHaveBeenCalled();
    });

    it('removes the test file and fails when it cannot be read back correctly', async () => {
      s3FileService.stat.mockImplementation(probeStat(0));

      await expect(service.probeWritable(target)).rejects.toMatchObject({ code: 'SIZE_MISMATCH' });
      expect(s3FileService.delete).toHaveBeenCalled();
    });
  });

  it('returns null for a missing disk file', async () => {
    await expect(service.stat(diskAt('does-not-exist.txt'), 'source')).resolves.toBeNull();
  });
});
