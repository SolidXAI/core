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
import { IFileService, WriteOptions, CopyOptions, UrlOptions } from './file-service.interface';
import { ERROR_MESSAGES } from 'src/constants/error-messages';

/**
 * S3-based implementation of IFileService.
 * Handles file operations on AWS S3.
 *
 * Configuration via environment variables:
 * - S3_AWS_ACCESS_KEY: AWS access key ID
 * - S3_AWS_SECRET_KEY: AWS secret access key
 * - S3_AWS_REGION_NAME: AWS region
 *
 * Path format: "bucket:key" (bucket is required, sourced from MediaStorageProviderMetadata entity)
 */
@Injectable()
export class S3FileService implements IFileService, OnModuleInit {
  private readonly logger = new Logger(S3FileService.name);
  private s3Client: S3Client | null = null;

  onModuleInit() {
    this.initializeS3Client();
  }

  private initializeS3Client(): void {
    const accessKey = process.env.S3_AWS_ACCESS_KEY;
    const secretKey = process.env.S3_AWS_SECRET_KEY;
    const region = process.env.S3_AWS_REGION_NAME;

    if (!accessKey || !secretKey || !region) {
      this.logger.warn('S3 credentials not fully configured. S3FileService will not be available.');
      return;
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    this.logger.log('S3FileService initialized successfully');
  }

  private ensureS3Client(): void {
    if (!this.s3Client) {
      throw new Error(ERROR_MESSAGES.S3_CLIENT_NOT_INITIALIZED);
    }
  }

  /**
   * Parse path to extract bucket and key.
   * Format: "bucket:key" (bucket is required)
   *
   * @param path - Path in format "bucket:key"
   * @returns Object with bucket and key
   * @throws Error if path format is invalid (missing bucket)
   */
  private parsePath(path: string): { bucket: string; key: string } {
    const colonIndex = path.indexOf(':');
    if (colonIndex > 0 && colonIndex < path.length - 1) {
      return {
        bucket: path.substring(0, colonIndex),
        key: path.substring(colonIndex + 1),
      };
    }
    throw new Error(`Invalid S3 path format: "${path}". Expected format: "bucket:key"`);
  }

  /**
   * Read file contents as Buffer
   */
  async read(path: string): Promise<Buffer> {
    this.ensureS3Client();
    const { bucket, key } = this.parsePath(path);

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await this.s3Client.send(command);

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
  async readStream(path: string): Promise<Readable> {
    this.ensureS3Client();
    const { bucket, key } = this.parsePath(path);

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await this.s3Client.send(command);

    return response.Body as Readable;
  }

  /**
   * Write data to S3
   */
  async write(path: string, data: Buffer | string, options?: WriteOptions): Promise<void> {
    this.ensureS3Client();
    const { bucket, key } = this.parsePath(path);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: typeof data === 'string' ? Buffer.from(data) : data,
      ContentType: options?.contentType,
    });

    await this.s3Client.send(command);
    this.logger.debug(`File uploaded to S3: ${bucket}/${key}`);
  }

  /**
   * Write a stream to S3
   */
  async writeStream(path: string, stream: Readable, options?: WriteOptions): Promise<void> {
    this.ensureS3Client();
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

    await this.s3Client.send(command);
    this.logger.debug(`File uploaded to S3 via stream: ${bucket}/${key}`);
  }

  /**
   * Delete a file from S3
   */
  async delete(path: string): Promise<void> {
    this.ensureS3Client();
    const { bucket, key } = this.parsePath(path);

    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await this.s3Client.send(command);
    this.logger.debug(`File deleted from S3: ${bucket}/${key}`);
  }

  /**
   * Check if file exists in S3
   */
  async exists(path: string): Promise<boolean> {
    this.ensureS3Client();
    const { bucket, key } = this.parsePath(path);

    try {
      const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
      await this.s3Client.send(command);
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
    this.ensureS3Client();

    if (options?.overwrite === false) {
      const destinationExists = await this.exists(destinationPath);
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

    await this.s3Client.send(command);
    this.logger.debug(`File copied in S3: ${source.bucket}/${source.key} -> ${destination.bucket}/${destination.key}`);
  }

  /**
   * Get a signed URL for the file
   */
  async getUrl(path: string, options?: UrlOptions): Promise<string> {
    this.ensureS3Client();
    const { bucket, key } = this.parsePath(path);

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const expiresIn = options?.expiresIn || 3600; // Default 1 hour

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
