import { Inject, Injectable } from '@nestjs/common';
import * as fs from 'fs';
// import * as AWS from 'aws-sdk';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { ConfigType } from '@nestjs/config';
import commonConfig from '../config/common.config';
import path from 'path';




@Injectable()
export class FileService {

  private readonly s3Client: S3Client;

  constructor(
    @Inject(commonConfig.KEY)
    private readonly commonConfiguration: ConfigType<typeof commonConfig>,

  ) {
    this.s3Client = new S3Client({
      region: this.commonConfiguration.awsS3Credentials.S3_AWS_REGION_NAME,
      credentials: {
        accessKeyId: this.commonConfiguration.awsS3Credentials.S3_AWS_ACCESS_KEY,
        secretAccessKey: this.commonConfiguration.awsS3Credentials.S3_AWS_SECRET_KEY,
      },
      // endpoint: `https://${process.env.S3_AWS_BUCKET_NAME}.s3.${process.env.S3_AWS_REGION_NAME}.amazonaws.com`, // Correct regional endpoint

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
      throw new Error(`Error copying file: ${error.message}`);
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
      throw new Error(`Error copying file: ${error.message}`);
    }
  }

  async copyToS3WithPublic(filePath: string, ContentType: string, fileName: string, bucketName: string): Promise<string> {
    try {
      // Read Image File TO Fetch Buffer 
      const data = await this.readImageFile(filePath);

      const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: data,
        ContentType: ContentType, // Set the correct MIME type
        ACL: "public-read" as ObjectCannedACL
      };
      // Upload it to S3
      // const response = await this.s3.upload(params).promise();
      const command = new PutObjectCommand(params);
      const response = await this.s3Client.send(command);

      // Return the URL file Name
      // To access the file  - https://rep-public-files.s3.amazonaws.com/${fileName}
      return fileName

    } catch (error) {
      throw new Error(`Error copying file: ${error.message}`);
    }
  }

  async deleteFromS3(fileName: string, bucketName: string): Promise<string> {

    const params = {
      Bucket: bucketName,  // your S3 bucket name
      Key: fileName        // the name of the file you want to delete    
    };

    const command = new DeleteObjectCommand(params)
    const response = await this.s3Client.send(command);
    return fileName
  }
}
