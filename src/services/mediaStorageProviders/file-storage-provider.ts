import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CommonEntity } from "src/entities/common.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { Media } from "src/entities/media.entity";
import { MediaStorageProvider } from "src/interfaces";
import { MediaRepository } from "src/repository/media.repository";
import { FileService } from "src/services/file.service";
import { Readable } from "stream";
import { SettingService } from "../setting.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

@Injectable()
export class FileStorageProvider<T> implements MediaStorageProvider<T> {
    private logger = new Logger(FileStorageProvider.name);

    constructor(
        // @Inject(appBuilderConfig.KEY)
        // private readonly appBuilderConfiguration: ConfigType<typeof appBuilderConfig>,
        private readonly configService: ConfigService,
        readonly fileService: FileService,
        readonly mediaRepository: MediaRepository,
        private readonly settingService: SettingService

    ) { }

    async retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        //@ts-ignore
        const media = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        // Add the full URL to the media
        // media.forEach(m => {
        // });
        for (const m of media) {
            m['_full_url'] = `${this.settingService.getConfigValue<SolidCoreSetting>("baseUrl")}/${this.getFullFilePath(m.relativeUri)}`;
        }


        return media;
    }

    async store(files: Express.Multer.File[], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        const result: Media[] = [];
        for (const file of files) {
            // Store the file in the configured file storage directory
            const fileStoragePath = await this.getFullFilePath(this.getFileName(file));
            await this.fileService.copyFile(file.path, fileStoragePath);
            await this.fileService.deleteFile(file.path);

            // Create an entry in the media table
            const mediaEntity = await this.mediaRepository.createMedia({
                //@ts-ignore
                entityId: entity.id,
                modelMetadataId: mediaFieldMetadata.model.id,
                relativeUri: this.getFileName(file),
                mimeType: file.mimetype,
                fileSize: file.size,
                originalFileName: file.originalname,
                mediaStorageProviderMetadataId: mediaFieldMetadata.mediaStorageProvider.id,
                fieldMetadataId: mediaFieldMetadata.id
            }) as unknown as Media;
            result.push(mediaEntity);
            this.logger.debug(`Stored media with`, mediaEntity);
        };
        return result;
    }

    async storeStreams(streamPairs: [Readable, string][], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        const result: Media[] = [];
        for (const pair of streamPairs) {
            const stream = pair[0];
            const fileName = pair[1];
            this.fileService.writeStreamToFile(stream, await this.getFullFilePath(fileName));
            const mediaEntity = await this.mediaRepository.createMedia({
                //@ts-ignore
                entityId: entity.id,
                modelMetadataId: mediaFieldMetadata.model.id,
                relativeUri: fileName,
                mediaStorageProviderMetadataId: mediaFieldMetadata.mediaStorageProvider.id,
                fieldMetadataId: mediaFieldMetadata.id
            }) as unknown as Media;
            this.logger.debug(`Stored media with`, mediaEntity);
        };
        return result;
    }

    async delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void> {
        // if (!(entity instanceof CommonEntity)) {
        //     throw new Error("Entity must be an instance of CommonEntity"); //FIXME This needs to be handled through generics. e.g T extends CommonEntity
        // }
        //@ts-ignore
        const existingMedia = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id, ['mediaStorageProviderMetadata']);
        //@ts-ignore
        this.mediaRepository.deleteByEntityIdAndFieldIdAndModelMetadataId(entity.id, mediaFieldMetadata.id, mediaFieldMetadata.model.id);

        for (const media of existingMedia) {
            this.fileService.deleteFile(await this.getFullFilePath(media.relativeUri));
        }
        // existingMedia.forEach(media => {
        // });
    }

    private async getFullFilePath(fileName: string): Promise<string> {
        const fileStorageDir = this.settingService.getConfigValue<SolidCoreSetting>("fileStorageDir")
        return `${fileStorageDir}/${fileName}`;
        // return `${this.configService.get('app-builder.fileStorageDir')}/${fileName}`;
    }

    private getFileName(file: Express.Multer.File): string {
        return `${file.filename}-${file.originalname}`;
    }
}