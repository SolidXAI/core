import { Readable } from 'stream';

export interface WriteOptions {
  contentType?: string;
  /** AWS region override (S3 only) - uses default region from env if not specified */
  region?: string;
}

export interface CopyOptions {
  contentType?: string;
  /** Whether to overwrite existing file (default: true) */
  overwrite?: boolean;
  /** AWS region override (S3 only) - uses default region from env if not specified */
  region?: string;
}

export interface UrlOptions {
  /** Expiry time in seconds (relevant for S3 signed URLs) */
  expiresIn?: number;
  /** AWS region override (S3 only) - uses default region from env if not specified */
  region?: string;
  /** whether the bucket is a private bucket or not */
  isPrivateBucket?: boolean;
}

export interface ReadOptions {
  /** AWS region override (S3 only) - uses default region from env if not specified */
  region?: string;
}

export interface DeleteOptions {
  /** AWS region override (S3 only) - uses default region from env if not specified */
  region?: string;
}

export interface ExistsOptions {
  /** AWS region override (S3 only) - uses default region from env if not specified */
  region?: string;
}

/**
 * Unified interface for file operations.
 * Implementations: DiskFileService, S3FileService
 */
export interface IFileService {
  /**
   * Read file contents as Buffer
   * @param path - File path (disk) or key (S3)
   * @param options - Optional read options (e.g., region for S3)
   */
  read(path: string, options?: ReadOptions): Promise<Buffer>;

  /**
   * Read file contents as a stream
   * @param path - File path (disk) or key (S3)
   * @param options - Optional read options (e.g., region for S3)
   */
  readStream(path: string, options?: ReadOptions): Promise<Readable>;

  /**
   * Write data to a file
   * @param path - File path (disk) or key (S3)
   * @param data - Content to write
   * @param options - Optional write options (e.g., contentType, region for S3)
   */
  write(path: string, data: Buffer | string, options?: WriteOptions): Promise<string>;

  /**
   * Write a stream to a file
   * @param path - File path (disk) or key (S3)
   * @param stream - Readable stream
   * @param options - Optional write options (e.g., contentType, region for S3)
   */
  writeStream(path: string, stream: Readable, options?: WriteOptions): Promise<string>;

  /**
   * Delete a file
   * @param path - File path (disk) or key (S3)
   * @param options - Optional delete options (e.g., region for S3)
   */
  delete(path: string, options?: DeleteOptions): Promise<void>;

  /**
   * Check if file exists
   * @param path - File path (disk) or key (S3)
   * @param options - Optional exists options (e.g., region for S3)
   */
  exists(path: string, options?: ExistsOptions): Promise<boolean>;

  /**
   * Copy a file from source to destination
   * @param sourcePath - Source file path
   * @param destinationPath - Destination file path
   * @param options - Optional copy options (e.g., region for S3)
   */
  copy(sourcePath: string, destinationPath: string, options?: CopyOptions): Promise<void>;

  /**
   * Get an accessible URL for the file
   * For S3: returns signed URL; For disk: returns the file path
   * @param path - File path (disk) or key (S3)
   * @param options - URL options (e.g., expiresIn, region for S3)
   */
  getUrl(path: string, options?: UrlOptions): Promise<string>;
}

export const FILE_SERVICE = Symbol('FILE_SERVICE');
