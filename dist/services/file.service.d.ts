import { ConfigType } from '@nestjs/config';
import commonConfig from '../config/common.config';
export declare class FileService {
    private readonly commonConfiguration;
    private readonly s3Client;
    constructor(commonConfiguration: ConfigType<typeof commonConfig>);
    readFile(filePath: string): Promise<string | Buffer>;
    readImageFile(filePath: string): Promise<Buffer>;
    writeFile(filePath: string, data: string | Buffer): Promise<void>;
    copyFile(sourcePath: string, destinationPath: string): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    copyToS3(filePath: string, ContentType: string, fileName: string, bucketName: string): Promise<string>;
    copyToS3WithPublic(filePath: string, ContentType: string, fileName: string, bucketName: string): Promise<string>;
    deleteFromS3(fileName: string, bucketName: string): Promise<string>;
}
