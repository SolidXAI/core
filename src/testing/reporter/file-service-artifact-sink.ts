import type { Readable } from 'stream';
import type { IFileService } from '../../services/file/file-service.interface';
import type { IArtifactSink } from './artifact-sink';

async function toBuffer(data: Buffer | NodeJS.ReadableStream): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data;
  const chunks: Buffer[] = [];
  for await (const chunk of data as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Concrete {@link IArtifactSink} backed by the core {@link IFileService}. Persists binary
 * test artifacts (screenshots, video, HAR) to shared storage — disk by default, S3 when
 * `DEFAULT_FILE_SERVICE=s3` — so webhook payloads stay small and the DB never holds blobs.
 *
 * Keys are laid out as `<prefix>/<runId>/<scenarioId>/<name>`. Callers that need a durable,
 * provider-agnostic URL (e.g. a private S3 bucket) should serve by `storageKey` through their
 * own proxy rather than relying on the raw `url` (which for S3 is the un-signed object URL).
 */
export class FileServiceArtifactSink implements IArtifactSink {
  constructor(
    private readonly fileService: IFileService,
    private readonly opts: { prefix?: string; region?: string } = {},
  ) {}

  async put(args: {
    runId: string;
    scenarioId: string;
    name: string;
    contentType: string;
    data: Buffer | NodeJS.ReadableStream;
  }): Promise<{ storageKey: string; url: string; sizeBytes: number }> {
    const prefix = this.opts.prefix ?? 'test-artifacts';
    const safe = (s: string) => String(s || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'artifact';
    const storageKey = `${prefix}/${safe(args.runId)}/${safe(args.scenarioId)}/${safe(args.name)}`;
    const buffer = await toBuffer(args.data);
    const url = await this.fileService.write(storageKey, buffer, {
      contentType: args.contentType,
      region: this.opts.region,
    });
    return { storageKey, url, sizeBytes: buffer.byteLength };
  }
}
