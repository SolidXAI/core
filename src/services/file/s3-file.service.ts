import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { IFileService, WriteOptions, CopyOptions, UrlOptions, ReadOptions, DeleteOptions, ExistsOptions } from './file-service.interface';
import { ERROR_MESSAGES } from 'src/constants/error-messages';

/**
 * S3-based implementation of IFileService.
 * Handles file operations on AWS S3.
 *
 * Configuration via environment variables:
 * - S3_AWS_ACCESS_KEY: AWS access key ID
 * - S3_AWS_SECRET_KEY: AWS secret access key
 * - S3_AWS_REGION_NAME: AWS region
 * - S3_DEFAULT_BUCKET: Default bucket used when path has no "bucket:" prefix
 *
 * Path format: "bucket:key" or just "key" (falls back to S3_DEFAULT_BUCKET)
 */
@Injectable()
export class S3FileService implements IFileService, OnModuleInit {
  private readonly logger = new Logger(S3FileService.name);
  private readonly s3ClientCache = new Map<string, S3Client>();
  private defaultRegion: string | null = null;
  private defaultBucket: string | null = null;
  private accessKey: string | null = null;
  private secretKey: string | null = null;

  onModuleInit() {
    this.initializeS3Credentials();
  }

  private initializeS3Credentials(): void {
    this.accessKey = process.env.S3_AWS_ACCESS_KEY || null;
    this.secretKey = process.env.S3_AWS_SECRET_KEY || null;
    this.defaultRegion = process.env.S3_AWS_REGION_NAME || null;
    this.defaultBucket = process.env.S3_DEFAULT_BUCKET || null;

    if (!this.accessKey || !this.secretKey) {
      this.logger.warn('S3 credentials not fully configured. S3FileService will not be available.');
      return;
    }

    // Pre-initialize client for default region if available
    if (this.defaultRegion) {
      this.getOrCreateClient(this.defaultRegion);
      this.logger.log(`S3FileService initialized successfully with default region: ${this.defaultRegion}`);
    } else {
      this.logger.log('S3FileService initialized successfully (no default region, will use per-request region)');
    }
  }

  private getOrCreateClient(region: string): S3Client {
    if (!this.accessKey || !this.secretKey) {
      throw new Error(ERROR_MESSAGES.S3_CLIENT_NOT_INITIALIZED);
    }

    let client = this.s3ClientCache.get(region);
    if (!client) {
      client = new S3Client({
        region,
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
      });
      this.s3ClientCache.set(region, client);
      this.logger.debug(`Created S3 client for region: ${region}`);
    }
    return client;
  }

  private getS3Client(region?: string): S3Client {
    const effectiveRegion = region || this.defaultRegion;
    if (!effectiveRegion) {
      throw new Error('S3 region not specified and no default region configured. Please provide a region or set S3_AWS_REGION_NAME environment variable.');
    }
    return this.getOrCreateClient(effectiveRegion);
  }

  /**
   * Parse path to extract bucket and key.
   * Format: "bucket:key" or just "key" (falls back to S3_DEFAULT_BUCKET)
   *
   * @param path - Path in format "bucket:key" or just "key"
   * @returns Object with bucket and key
   * @throws Error if no bucket can be resolved
   */
  private parsePath(path: string): { bucket: string; key: string } {
    const colonIndex = path.indexOf(':');
    if (colonIndex > 0 && colonIndex < path.length - 1) {
      return {
        bucket: path.substring(0, colonIndex),
        key: path.substring(colonIndex + 1),
      };
    }
    if (this.defaultBucket) {
      return { bucket: this.defaultBucket, key: path };
    }
    throw new Error(`Invalid S3 path format: "${path}". Expected format: "bucket:key" or set S3_DEFAULT_BUCKET environment variable.`);
  }

  /**
   * Read file contents as Buffer
   */
  async read(path: string, options?: ReadOptions): Promise<Buffer> {
    const s3Client = this.getS3Client(options?.region);
    const { bucket, key } = this.parsePath(path);

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);

    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Read file contents as a stream
   */
  async readStream(path: string, options?: ReadOptions): Promise<Readable> {
    const s3Client = this.getS3Client(options?.region);
    const { bucket, key } = this.parsePath(path);

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);

    return response.Body as Readable;
  }

  /**
   * Write data to S3
   * @returns Public URL of the uploaded file
   */
  async write(path: string, data: Buffer | string, options?: WriteOptions): Promise<string> {
    const region = options?.region || this.defaultRegion;
    const s3Client = this.getS3Client(region);
    const { bucket, key } = this.parsePath(path);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: typeof data === 'string' ? Buffer.from(data) : data,
      ContentType: options?.contentType,
    });

    await s3Client.send(command);
    this.logger.debug(`File uploaded to S3: ${bucket}/${key}`);
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Write a stream to S3
   * @returns Public URL of the uploaded file
   */
  async writeStream(path: string, stream: Readable, options?: WriteOptions): Promise<string> {
    const region = options?.region || this.defaultRegion;
    const s3Client = this.getS3Client(region);
    const { bucket, key } = this.parsePath(path);

    // For streaming uploads, we need to collect the stream into a buffer
    // For very large files, consider using @aws-sdk/lib-storage Upload class
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: options?.contentType,
    });

    await s3Client.send(command);
    this.logger.debug(`File uploaded to S3 via stream: ${bucket}/${key}`);
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Delete a file from S3
   */
  async delete(path: string, options?: DeleteOptions): Promise<void> {
    const s3Client = this.getS3Client(options?.region);
    const { bucket, key } = this.parsePath(path);

    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await s3Client.send(command);
    this.logger.debug(`File deleted from S3: ${bucket}/${key}`);
  }

  /**
   * Check if file exists in S3
   */
  async exists(path: string, options?: ExistsOptions): Promise<boolean> {
    const s3Client = this.getS3Client(options?.region);
    const { bucket, key } = this.parsePath(path);

    try {
      const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
      await s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Copy a file within S3 (same or different bucket)
   */
  async copy(sourcePath: string, destinationPath: string, options?: CopyOptions): Promise<void> {
    const s3Client = this.getS3Client(options?.region);

    if (options?.overwrite === false) {
      const destinationExists = await this.exists(destinationPath, { region: options?.region });
      if (destinationExists) {
        throw new Error(`Destination file already exists: ${destinationPath}`);
      }
    }

    const source = this.parsePath(sourcePath);
    const destination = this.parsePath(destinationPath);

    const command = new CopyObjectCommand({
      Bucket: destination.bucket,
      Key: destination.key,
      CopySource: `${source.bucket}/${source.key}`,
      ContentType: options?.contentType,
    });

    await s3Client.send(command);
    this.logger.debug(`File copied in S3: ${source.bucket}/${source.key} -> ${destination.bucket}/${destination.key}`);
  }

  /**
   * Get a signed URL for the file
   */
  async getUrl(path: string, options?: UrlOptions): Promise<string> {
    const s3Client = this.getS3Client(options?.region);
    const { bucket, key } = this.parsePath(path);

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const expiresIn = options?.expiresIn || 3600; // Default 1 hour

    return options.expiresIn > 0? getSignedUrl(s3Client, command, { expiresIn }) : `https://${bucket}.s3.${options?.region || this.defaultRegion}.amazonaws.com/${key}`;
  }
}
