import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MediaTransferService } from './media-transfer.service';
import { MediaLocation } from './media-location';

// Real files are used for disk copies. They live in a temporary folder inside the repo
// (not the system temp dir) and are removed after the tests.
const workDir = path.join(process.cwd(), '.media-migration-test-tmp');

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
    };
    service = new MediaTransferService(diskFileService, s3FileService);
  });

  const diskAt = (name: string): MediaLocation => ({ kind: 'disk', absolutePath: path.join(workDir, name) });

  it('copies a file on disk with the same content and leaves no temporary file behind', async () => {
    const src = diskAt('src.txt');
    fs.writeFileSync(src.kind === 'disk' ? src.absolutePath : '', 'hello');
    const dst = diskAt('nested/dst.txt');

    await service.copy(src, dst, { sourceSize: 5 });

    expect(fs.readFileSync(dst.kind === 'disk' ? dst.absolutePath : '', 'utf8')).toBe('hello');
    expect(fs.readdirSync(path.dirname(dst.kind === 'disk' ? dst.absolutePath : '')).filter(f => f.includes('migrating'))).toEqual([]);
  });

  it('removes the temporary file and leaves no destination when a disk copy fails', async () => {
    const src = diskAt('missing.txt');
    const dst = diskAt('failed.txt');

    await expect(service.copy(src, dst, { sourceSize: 1 })).rejects.toMatchObject({ code: 'UNKNOWN' });
    expect(fs.existsSync(dst.kind === 'disk' ? dst.absolutePath : '')).toBe(false);
    expect(fs.readdirSync(workDir).filter(f => f.includes('migrating'))).toEqual([]);
  });

  it('copies small S3 objects with a single server-side copy', async () => {
    const src: MediaLocation = { kind: 's3', bucket: 'a', key: 'x.png', region: 'r' };
    const dst: MediaLocation = { kind: 's3', bucket: 'b', key: 'x.png', region: 'r' };

    await service.copy(src, dst, { sourceSize: 1024 });

    expect(s3FileService.copy).toHaveBeenCalledWith('a:x.png', 'b:x.png', { region: 'r' });
    expect(s3FileService.readStream).not.toHaveBeenCalled();
  });

  it('streams S3 objects larger than 5 GB instead of using a single copy', async () => {
    const src: MediaLocation = { kind: 's3', bucket: 'a', key: 'big.mp4', region: 'r' };
    const dst: MediaLocation = { kind: 's3', bucket: 'b', key: 'big.mp4', region: 'r' };
    s3FileService.readStream.mockResolvedValue(fs.createReadStream(__filename));

    await service.copy(src, dst, { sourceSize: 6 * 1024 * 1024 * 1024 });

    expect(s3FileService.copy).not.toHaveBeenCalled();
    expect(s3FileService.writeStream).toHaveBeenCalledWith('b:big.mp4', expect.anything(), { region: 'r', contentType: undefined });
  });

  it('probes a target with a small test file and removes it afterwards', async () => {
    const target: MediaLocation = { kind: 's3', bucket: 'b', key: 'x.png', region: 'r' };
    s3FileService.stat.mockImplementation(async (p: string) => (p.startsWith('b:.solidx-migration-probe-') ? { size: 1 } : null));

    await service.probeWritable(target);

    expect(s3FileService.write).toHaveBeenCalledWith(expect.stringMatching(/^b:\.solidx-migration-probe-/), expect.any(Buffer), { region: 'r' });
    expect(s3FileService.delete).toHaveBeenCalledWith(expect.stringMatching(/^b:\.solidx-migration-probe-/), { region: 'r' });
  });

  it('reports a failed probe as a target write problem', async () => {
    const target: MediaLocation = { kind: 's3', bucket: 'b', key: 'x.png', region: 'r' };
    s3FileService.write.mockRejectedValue({ name: 'AccessDenied' });

    await expect(service.probeWritable(target)).rejects.toMatchObject({ code: 'TARGET_WRITE_DENIED' });
  });

  it('returns null for a missing disk file', async () => {
    await expect(service.stat(diskAt('does-not-exist.txt'), 'source')).resolves.toBeNull();
  });
});
