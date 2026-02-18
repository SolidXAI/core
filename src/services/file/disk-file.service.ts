import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { IFileService, WriteOptions, CopyOptions, UrlOptions } from './file-service.interface';

/**
 * Disk-based implementation of IFileService.
 * Handles file operations on the local filesystem.
 */
@Injectable()
export class DiskFileService implements IFileService {
  private readonly logger = new Logger(DiskFileService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BASE_URL || '';
  }

  /**
   * Read file contents as Buffer
   */
  async read(filePath: string): Promise<Buffer> {
    return fsPromises.readFile(filePath);
  }

  /**
   * Read file contents as a stream
   */
  async readStream(filePath: string): Promise<Readable> {
    // Verify file exists before creating stream
    await fsPromises.access(filePath, fs.constants.F_OK);
    return fs.createReadStream(filePath);
  }

  /**
   * Write data to a file
   * Automatically creates parent directories if they don't exist
   * @returns Public URL of the written file
   */
  async write(filePath: string, data: Buffer | string, options?: WriteOptions): Promise<string> {
    await this.ensureDirectoryExists(filePath);
    await fsPromises.writeFile(filePath, data);
    return `${this.baseUrl}/${filePath}`;
  }

  /**
   * Write a stream to a file
   * Automatically creates parent directories if they don't exist
   * @returns Public URL of the written file
   */
  async writeStream(filePath: string, stream: Readable, options?: WriteOptions): Promise<string> {
    await this.ensureDirectoryExists(filePath);
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(stream, writeStream);
    this.logger.debug(`File saved via stream: ${filePath}`);
    return `${this.baseUrl}/${filePath}`;
  }

  /**
   * Delete a file
   */
  async delete(filePath: string): Promise<void> {
    await fsPromises.unlink(filePath);
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy a file from source to destination
   * Automatically creates parent directories if they don't exist
   */
  async copy(sourcePath: string, destinationPath: string, options?: CopyOptions): Promise<void> {
    if (options?.overwrite === false) {
      const destinationExists = await this.exists(destinationPath);
      if (destinationExists) {
        throw new Error(`Destination file already exists: ${destinationPath}`);
      }
    }

    await this.ensureDirectoryExists(destinationPath);
    const data = await this.read(sourcePath);
    await this.write(destinationPath, data, { contentType: options?.contentType });
  }

  /**
   * Get an accessible URL/path for the file
   * For disk storage, returns the file path as-is
   */
  async getUrl(filePath: string, options?: UrlOptions): Promise<string> {
    // For disk storage, we simply return the path
    // The caller is responsible for constructing a full URL if needed
    return filePath;
  }

  /**
   * Ensures the parent directory exists for the given file path
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    try {
      await fsPromises.access(dir, fs.constants.F_OK);
    } catch {
      await fsPromises.mkdir(dir, { recursive: true });
    }
  }
}
