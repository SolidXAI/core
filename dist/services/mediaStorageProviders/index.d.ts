import { MediaStorageProviderType } from "src/dtos/create-media-storage-provider-metadata.dto";
import { MediaStorageProvider } from "src/interfaces";
import { ConfigService } from "@nestjs/config";
import { FileService } from "src/services/file.service";
import { MediaService } from "../media.service";
export declare function getMediaStorageProvider<T>(configService: ConfigService, fileService: FileService, mediaService: MediaService, type: MediaStorageProviderType): MediaStorageProvider<T>;
