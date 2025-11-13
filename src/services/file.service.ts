import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
// import * as AWS from 'aws-sdk';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ObjectCannedACL, GetObjectCommand } from '@aws-sdk/client-s3';
import { ConfigType } from '@nestjs/config';
import commonConfig, { AwsS3Config } from '../config/common.config';
import path from 'path';
import { Readable } from 'stream';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ERROR_MESSAGES } from 'src/constants/error-messages';

@Injectable()
export class FileService {

  private readonly s3Client: S3Client;
  private readonly logger = new Logger(FileService.name);

  constructor(
    @Inject(commonConfig.KEY)
    private readonly commonConfiguration: ConfigType<typeof commonConfig>,

  ) {
    if (!this.isValidS3Config(this.commonConfiguration.awsS3Credentials)) { return }
    this.s3Client = new S3Client({
      region: this.commonConfiguration.awsS3Credentials.S3_AWS_REGION_NAME,
      credentials: {
        accessKeyId: this.commonConfiguration.awsS3Credentials.S3_AWS_ACCESS_KEY,
        secretAccessKey: this.commonConfiguration.awsS3Credentials.S3_AWS_SECRET_KEY,
      },
    });
  }

  readFile(filePath: string): Promise<string | Buffer> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  readImageFile(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve(data); // Resolve with Buffer instead of string
      });

    });
  }

  writeFile(filePath: string, data: string | Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const data = await this.readFile(sourcePath);
      await this.createDirectoryIfNotExists(destinationPath);
      await this.writeFile(destinationPath, data);
    } catch (error) {
      throw new Error(`${ERROR_MESSAGES.FILE_COPY_ERROR}: ${error.message}`);
    }
  }

  async createDirectoryIfNotExists(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  deleteFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.unlink(filePath, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  async copyToS3(filePath: string, ContentType: string, fileName: string, bucketName: string): Promise<string> {
    this.checkIfS3ClientExists();
    try {
      // Read Image File TO Fetch Buffer 
      const data = await this.readImageFile(filePath);

      const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: data,
        ContentType: ContentType, // Set the correct MIME type

      };
      // Upload it to S3
      // const response = await this.s3.upload(params).promise();
      const command = new PutObjectCommand(params);
      const response = await this.s3Client.send(command);

      // Return the URL file Name
      // To access the file  - https://rep-public-files.s3.amazonaws.com/${fileName}
      return fileName

    } catch (error) {
      throw new Error(`${ERROR_MESSAGES.FILE_COPY_ERROR}: ${error.message}`);
    }
  }

  private checkIfS3ClientExists() {
    if (!this.s3Client) { throw new Error(ERROR_MESSAGES.S3_CLIENT_NOT_INITIALIZED); }
  }

  async copyToS3WithPublic(filePath: string, ContentType: string, fileName: string, bucketName: string): Promise<string> {
    return this.copyToS3(filePath, ContentType, fileName, bucketName);
  }

  async deleteFromS3(fileName: string, bucketName: string): Promise<string> {
    this.checkIfS3ClientExists();
    const params = {
      Bucket: bucketName,  // your S3 bucket name
      Key: fileName        // the name of the file you want to delete    
    };

    const command = new DeleteObjectCommand(params)
    const response = await this.s3Client.send(command);
    return fileName
  }

  private isValidS3Config(config: AwsS3Config): boolean {
    return !!config.S3_AWS_ACCESS_KEY && !!config.S3_AWS_SECRET_KEY && !!config.S3_AWS_REGION_NAME;
  }

  /**
   * Save a stream to a file
   * @param stream - Readable stream
   * @param filePath - Destination file path
   * @returns Promise<void>
   */
  public async writeStreamToFile(stream: Readable, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);

      writeStream.on('finish', () => {
        this.logger.debug(`✅ File saved: ${filePath}`);
        resolve();
      });

      writeStream.on('error', (err) => {
        this.logger.debug(`❌ Error saving file: ${filePath}`, err);
        reject(err);
      });
    });
  }

  public async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async getSignedUrl(key: string, expiresIn: number, bucketName: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return awsGetSignedUrl(this.s3Client, command, { expiresIn });
  }

}
