import { ConfigService } from "@nestjs/config";
import { MediaStorageProvider } from "src/interfaces";
import { FileService } from "src/services/file.service";
import { MediaService } from "../media.service";
import { Media } from "src/entities/media.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
export declare class FileStorageProvider<T> implements MediaStorageProvider<T> {
    private readonly configService;
    readonly fileService: FileService;
    readonly mediaService: MediaService;
    private logger;
    constructor(configService: ConfigService, fileService: FileService, mediaService: MediaService);
    retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]>;
    store(files: Express.Multer.File[], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]>;
    delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void>;
    private getFullFilePath;
    private getFileName;
}
