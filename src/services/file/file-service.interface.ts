import { Readable } from 'stream';

export interface WriteOptions {
  contentType?: string;
}

export interface CopyOptions {
  contentType?: string;
  /** Whether to overwrite existing file (default: true) */
  overwrite?: boolean;
}

export interface UrlOptions {
  /** Expiry time in seconds (relevant for S3 signed URLs) */
  expiresIn?: number;
}

/**
 * Unified interface for file operations.
 * Implementations: DiskFileService, S3FileService
 */
export interface IFileService {
  /**
   * Read file contents as Buffer
   * @param path - File path (disk) or key (S3)
   */
  read(path: string): Promise<Buffer>;

  /**
   * Read file contents as a stream
   * @param path - File path (disk) or key (S3)
   */
  readStream(path: string): Promise<Readable>;

  /**
   * Write data to a file
   * @param path - File path (disk) or key (S3)
   * @param data - Content to write
   * @param options - Optional write options (e.g., contentType for S3)
   */
  write(path: string, data: Buffer | string, options?: WriteOptions): Promise<void>;

  /**
   * Write a stream to a file
   * @param path - File path (disk) or key (S3)
   * @param stream - Readable stream
   * @param options - Optional write options (e.g., contentType for S3)
   */
  writeStream(path: string, stream: Readable, options?: WriteOptions): Promise<void>;

  /**
   * Delete a file
   * @param path - File path (disk) or key (S3)
   */
  delete(path: string): Promise<void>;

  /**
   * Check if file exists
   * @param path - File path (disk) or key (S3)
   */
  exists(path: string): Promise<boolean>;

  /**
   * Copy a file from source to destination
   * @param sourcePath - Source file path
   * @param destinationPath - Destination file path
   * @param options - Optional copy options
   */
  copy(sourcePath: string, destinationPath: string, options?: CopyOptions): Promise<void>;

  /**
   * Get an accessible URL for the file
   * For S3: returns signed URL; For disk: returns the file path
   * @param path - File path (disk) or key (S3)
   * @param options - URL options (e.g., expiresIn for S3)
   */
  getUrl(path: string, options?: UrlOptions): Promise<string>;
}

export const FILE_SERVICE = Symbol('FILE_SERVICE');
