import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { Readable } from 'stream';
import { DiskFileService, S3FileService } from 'src/services/file';
import { MediaLocation } from './media-location';
import { MigrationError, StorageRole, toMigrationError } from './migration-error';

// CopyObject works up to 5 GB. Larger S3 objects are streamed instead.
const MAX_SINGLE_COPY_BYTES = 5 * 1024 * 1024 * 1024;
const PROBE_PREFIX = '.solidx-migration-probe-';

function objectPath(location: { bucket: string; key: string }): string {
  return `${location.bucket}:${location.key}`;
}

function describe(location: MediaLocation): string {
  return location.kind === 'disk'
    ? `"${location.absolutePath}"`
    : `"${location.key}" in bucket "${location.bucket}"`;
}

function isNotFound(error: any): boolean {
  return error?.code === 'ENOENT' || error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404;
}

// Node file system errors carry a syscall; AWS SDK errors do not.
function isFileSystemError(error: any): boolean {
  return typeof error?.syscall === 'string' && typeof error?.code === 'string';
}

/**
 * Moves file bytes between locations (disk or S3). It never deletes or changes a source file.
 * Each copy writes to a temporary name first and renames it only when complete, so a crash
 * or error never leaves a partial file under the final name.
 */
@Injectable()
export class MediaTransferService {
  constructor(
    private readonly diskFileService: DiskFileService,
    private readonly s3FileService: S3FileService,
  ) { }

  /** Size of the stored file, or null if it does not exist. */
  async stat(location: MediaLocation, role: StorageRole): Promise<{ size: number } | null> {
    try {
      if (location.kind === 'disk') {
        return await this.diskFileService.stat(location.absolutePath);
      }
      return await this.s3FileService.stat(objectPath(location), { region: location.region });
    } catch (error) {
      throw toMigrationError(error, role, describe(location));
    }
  }

  /**
   * Fails with a clear error if an S3 bucket cannot be reached. `stat` cannot tell a missing
   * bucket from a missing file (both are a 404), so run this once per job before copying,
   * otherwise a mistyped bucket name shows up as every file being "not found".
   */
  async assertBucketReachable(location: MediaLocation, role: StorageRole): Promise<void> {
    if (location.kind !== 's3') {
      return;
    }
    let exists: boolean;
    try {
      exists = await this.s3FileService.bucketExists(location.bucket, { region: location.region });
    } catch (error) {
      throw toMigrationError(error, role, `bucket "${location.bucket}"`);
    }
    if (!exists) {
      throw new MigrationError(
        'BUCKET_NOT_FOUND',
        `Bucket "${location.bucket}" does not exist in region ${location.region}. Check the bucket name and the provider's region.`,
      );
    }
  }

  /**
   * Copies `source` to `target`. `sourceSize` decides whether an S3-to-S3 copy can use a
   * single server-side CopyObject or must be streamed, and sizes the multipart upload.
   */
  async copy(source: MediaLocation, target: MediaLocation, options: { sourceSize: number; contentType?: string }): Promise<void> {
    const upload = { contentType: options.contentType, contentLength: options.sourceSize };
    try {
      if (source.kind === 'disk' && target.kind === 'disk') {
        await this.writeAtomically(target.absolutePath, async tmp => {
          await fsPromises.copyFile(source.absolutePath, tmp);
        });
      } else if (source.kind === 'disk' && target.kind === 's3') {
        await this.useStream(fs.createReadStream(source.absolutePath), stream =>
          this.s3FileService.writeStream(objectPath(target), stream, { region: target.region, ...upload }));
      } else if (source.kind === 's3' && target.kind === 'disk') {
        const body = await this.s3FileService.readStream(objectPath(source), { region: source.region });
        await this.useStream(body, stream =>
          this.writeAtomically(target.absolutePath, tmp => this.diskFileService.writeStream(tmp, stream).then(() => undefined)));
      } else if (source.kind === 's3' && target.kind === 's3') {
        if (options.sourceSize <= MAX_SINGLE_COPY_BYTES) {
          await this.s3FileService.copy(objectPath(source), objectPath(target), { region: target.region });
        } else {
          const body = await this.s3FileService.readStream(objectPath(source), { region: source.region });
          await this.useStream(body, stream =>
            this.s3FileService.writeStream(objectPath(target), stream, { region: target.region, ...upload }));
        }
      }
    } catch (error) {
      throw await this.attributeCopyError(error, source, target);
    }
  }

  /**
   * Removes a stored file. Used for copies this job made, never for pre-existing files.
   * Deleting a file that is already gone succeeds on both disk and S3, so cleanup can be re-run.
   */
  async delete(location: MediaLocation, role: StorageRole = 'target'): Promise<void> {
    try {
      if (location.kind === 'disk') {
        await this.diskFileService.delete(location.absolutePath).catch(error => {
          if (error?.code !== 'ENOENT') {
            throw error;
          }
        });
      } else {
        await this.s3FileService.delete(objectPath(location), { region: location.region });
      }
    } catch (error) {
      throw toMigrationError(error, role, describe(location), 'delete');
    }
  }

  /**
   * Checks that a 1-byte file can be written, read back and deleted in the same folder or
   * bucket as `target`. Run before a job starts so permission problems fail fast. Delete
   * permission is required because rollback and cleanup need it.
   */
  async probeWritable(target: MediaLocation): Promise<void> {
    const probeName = `${PROBE_PREFIX}${randomUUID()}`;
    const probe: MediaLocation = target.kind === 'disk'
      ? { kind: 'disk', absolutePath: path.join(path.dirname(target.absolutePath), probeName) }
      : { ...target, key: probeName };
    const payload = Buffer.from('x');

    let written = false;
    try {
      if (probe.kind === 'disk') {
        await this.diskFileService.write(probe.absolutePath, payload);
      } else {
        await this.s3FileService.write(objectPath(probe), payload, { region: probe.region });
      }
      written = true;
      const stored = await this.stat(probe, 'target');
      if (!stored || stored.size !== payload.length) {
        throw new MigrationError('SIZE_MISMATCH', `The test file written to ${describe(probe)} could not be read back.`);
      }
    } catch (error) {
      if (written) {
        await this.delete(probe).catch(() => undefined);
      }
      throw toMigrationError(error, 'target', describe(probe));
    }

    try {
      await this.delete(probe);
    } catch (error) {
      const reason = error instanceof MigrationError ? error.message : String(error);
      throw new MigrationError(
        'DELETE_DENIED',
        `Files can be written to ${describe(probe)} but the test file could not be removed. ${reason} ` +
        `The test file "${probeName}" was left behind and can be deleted manually.`,
        error,
      );
    }
  }

  // Writes into a temporary sibling file, then renames it into place. Removes the temporary
  // file if the write fails.
  private async writeAtomically(finalPath: string, write: (tmpPath: string) => Promise<void>): Promise<void> {
    await fsPromises.mkdir(path.dirname(finalPath), { recursive: true });
    const tmpPath = `${finalPath}.migrating-${randomUUID()}`;
    try {
      await write(tmpPath);
      await fsPromises.rename(tmpPath, finalPath);
    } catch (error) {
      await fsPromises.rm(tmpPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  // Always releases the stream, even when the consumer fails before reading it. The no-op
  // listener only stops an unhandled 'error' event; the consumer still sees and reports the error.
  private async useStream<T>(stream: Readable, use: (stream: Readable) => Promise<T>): Promise<T> {
    stream.on('error', () => undefined);
    try {
      return await use(stream);
    } finally {
      stream.destroy();
    }
  }

  /**
   * Whether two stored files have identical content. Same size does not mean same file, so a
   * target that already holds a same-named file is compared by SHA-256 before it is trusted.
   */
  async sameContent(source: MediaLocation, target: MediaLocation): Promise<boolean> {
    const [sourceHash, targetHash] = await Promise.all([this.contentHash(source, 'source'), this.contentHash(target, 'target')]);
    return sourceHash === targetHash;
  }

  private async contentHash(location: MediaLocation, role: StorageRole): Promise<string> {
    try {
      const stream = location.kind === 'disk'
        ? fs.createReadStream(location.absolutePath)
        : await this.s3FileService.readStream(objectPath(location), { region: location.region });
      return await this.useStream(stream, async readable => {
        const hash = createHash('sha256');
        for await (const chunk of readable) {
          hash.update(chunk);
        }
        return hash.digest('hex');
      });
    } catch (error) {
      throw toMigrationError(error, role, describe(location));
    }
  }

  // Works out whether a copy failed reading the source or writing the target, so the message
  // points at the provider that needs attention.
  private async attributeCopyError(error: unknown, source: MediaLocation, target: MediaLocation): Promise<MigrationError> {
    if (error instanceof MigrationError) {
      return error;
    }

    let side: 'source' | 'target';
    if (source.kind === 's3' && target.kind === 's3') {
      // A server-side copy does not say which side failed. Ask the source directly.
      const check = await this.stat(source, 'source').then(result => result, failure => failure as MigrationError);
      if (check instanceof MigrationError) {
        return check;
      }
      if (check === null) {
        return this.sourceNotFound(source, error);
      }
      side = 'target';
    } else {
      side = await this.failedSide(error, source, target);
    }

    if (side === 'source') {
      return isNotFound(error)
        ? this.sourceNotFound(source, error)
        : toMigrationError(error, 'source', describe(source));
    }
    return toMigrationError(error, 'target', describe(target));
  }

  private async failedSide(error: any, source: MediaLocation, target: MediaLocation): Promise<'source' | 'target'> {
    if (source.kind === 'disk' && target.kind === 'disk') {
      // copyFile reports the source path whichever side failed, so decide by the error code.
      if (error?.code === 'ENOENT') {
        return 'source';
      }
      if (error?.code === 'EACCES' || error?.code === 'EPERM') {
        const readable = await fsPromises.access(source.absolutePath, fs.constants.R_OK).then(() => true, () => false);
        return readable ? 'target' : 'source';
      }
      return 'target';
    }
    if (source.kind === 'disk') {
      // Reading a local file fails with a file system error naming that file; anything else is S3.
      return isFileSystemError(error) && error.path === source.absolutePath ? 'source' : 'target';
    }
    // Reading from S3 and writing to disk: file system errors come from the disk write.
    return isFileSystemError(error) ? 'target' : 'source';
  }

  private sourceNotFound(source: MediaLocation, cause: unknown): MigrationError {
    return new MigrationError(
      'SOURCE_NOT_FOUND',
      `Source file ${describe(source)} was not found. It may have been deleted outside SolidX.`,
      cause,
    );
  }
}
