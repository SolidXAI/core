import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DiskFileService, S3FileService } from 'src/services/file';
import { MediaLocation } from './media-location';
import { StorageRole, toMigrationError } from './migration-error';

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
   * Copies `source` to `target`. `sourceSize` decides whether an S3-to-S3 copy can use a
   * single server-side CopyObject or must be streamed.
   */
  async copy(source: MediaLocation, target: MediaLocation, options: { sourceSize: number; contentType?: string }): Promise<void> {
    try {
      if (source.kind === 'disk' && target.kind === 'disk') {
        await this.writeAtomically(target.absolutePath, async tmp => {
          await fsPromises.copyFile(source.absolutePath, tmp);
        });
      } else if (source.kind === 'disk' && target.kind === 's3') {
        await this.s3FileService.writeStream(objectPath(target), fs.createReadStream(source.absolutePath), {
          region: target.region,
          contentType: options.contentType,
        });
      } else if (source.kind === 's3' && target.kind === 'disk') {
        const stream = await this.s3FileService.readStream(objectPath(source), { region: source.region });
        await this.writeAtomically(target.absolutePath, tmp => this.diskFileService.writeStream(tmp, stream).then(() => undefined));
      } else if (source.kind === 's3' && target.kind === 's3') {
        if (options.sourceSize <= MAX_SINGLE_COPY_BYTES) {
          await this.s3FileService.copy(objectPath(source), objectPath(target), { region: target.region });
        } else {
          const stream = await this.s3FileService.readStream(objectPath(source), { region: source.region });
          await this.s3FileService.writeStream(objectPath(target), stream, { region: target.region, contentType: options.contentType });
        }
      }
    } catch (error) {
      throw toMigrationError(error, 'target', describe(target));
    }
  }

  /** Removes a stored file. Used for copies this job made, never for pre-existing files. */
  async delete(location: MediaLocation): Promise<void> {
    try {
      if (location.kind === 'disk') {
        await this.diskFileService.delete(location.absolutePath);
      } else {
        await this.s3FileService.delete(objectPath(location), { region: location.region });
      }
    } catch (error) {
      throw toMigrationError(error, 'target', describe(location));
    }
  }

  /**
   * Checks that a 1-byte file can be written, read back and deleted in the same folder or
   * bucket as `target`. Run before a job starts so permission problems fail fast.
   */
  async probeWritable(target: MediaLocation): Promise<void> {
    const probe: MediaLocation = target.kind === 'disk'
      ? { kind: 'disk', absolutePath: path.join(path.dirname(target.absolutePath), `${PROBE_PREFIX}${randomUUID()}`) }
      : { ...target, key: `${PROBE_PREFIX}${randomUUID()}` };
    const payload = Buffer.from('x');

    try {
      if (probe.kind === 'disk') {
        await this.diskFileService.write(probe.absolutePath, payload);
      } else {
        await this.s3FileService.write(objectPath(probe), payload, { region: probe.region });
      }
      const stored = await this.stat(probe, 'target');
      if (!stored || stored.size !== payload.length) {
        throw new Error(`The test file written to ${describe(probe)} could not be read back`);
      }
    } catch (error) {
      throw toMigrationError(error, 'target', describe(probe));
    } finally {
      await this.delete(probe).catch(() => undefined);
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
}
