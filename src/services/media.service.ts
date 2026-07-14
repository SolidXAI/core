import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import * as path from 'path';
import { Readable } from 'stream';
import { DEFAULT_MEDIA_FILE_STORAGE_DIR } from "src/services/settings/default-settings-provider.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

import { ConfigService } from '@nestjs/config';
import { CRUDService } from 'src/services/crud.service';
import { DiskFileService, S3FileService } from 'src/services/file';
import { MediaDownloadUrlService } from 'src/services/media-download-url.service';


import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { BasicFilterDto } from 'src/dtos/basic-filters.dto';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { Media } from 'src/entities/media.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { FieldMetadataRepository } from 'src/repository/field-metadata.repository';
import { MediaStorageProviderMetadataRepository } from 'src/repository/media-storage-provider-metadata.repository';
import { MediaRepository } from 'src/repository/media.repository';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { getMediaStorageProvider } from "./mediaStorageProviders";

const DEFAULT_PRIVATE_MEDIA_STORAGE_DIR = "media-private-files-storage";

@Injectable()
export class MediaService extends CRUDService<Media> {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    readonly configService: ConfigService,
    readonly diskFileService: DiskFileService,
    readonly s3FileService: S3FileService,
    private readonly mediaDownloadUrlService: MediaDownloadUrlService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(Media, 'default')
    // readonly repo: Repository<Media>,
    readonly repo: MediaRepository,
    // @InjectRepository(ModelMetadata)
    // private readonly modelMetadataRepo: Repository<ModelMetadata>,
    // @InjectRepository(MediaStorageProviderMetadata)
    // private readonly mediaStorageProviderMetadataRepo: Repository<MediaStorageProviderMetadata>,
    // @InjectRepository(FieldMetadata)
    // private readonly fieldMetadataRepo: Repository<FieldMetadata>,
    @Inject(forwardRef(() => ModelMetadataRepository))
    private readonly modelMetadataRepo: ModelMetadataRepository,
    private readonly mediaStorageProviderMetadataRepo: MediaStorageProviderMetadataRepository,
    private readonly fieldMetadataRepo: FieldMetadataRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'media', 'solid-core', moduleRef);
  }

  async find(basicFilterDto: BasicFilterDto, solidRequestContext: any = {}) {
    const data = await super.find(basicFilterDto, solidRequestContext);
    if (data.records) {
      await this.decorateMediaRecords(data.records);
    }
    if (data.groupRecords) {
      for (const group of data.groupRecords) {
        await this.decorateMediaRecords(group.groupData.records);
      }
    }
    return data
  }

  async findOne(id: number, query: any = {}, solidRequestContext: any = {}) {
    const media = await super.findOne(id, query, solidRequestContext);
    if (media) {
      await this.decorateMediaRecord(media);
    }
    return media;
  }

  async upload(createDto: any, files: Array<Express.Multer.File>, _solidRequestContext: any = {}) {

    if (!files || files.length === 0) {
      throw new NotFoundException(ERROR_MESSAGES.FILE_NOT_FOUND);

    }

    createDto['fieldMetadata'] = await this.fieldMetadataRepo.findOne({
      where: {
        id: createDto['fieldMetadataId']
      },
      relations: ['mediaStorageProvider', 'model'],
    });
    createDto['modelMetadata'] = await this.modelMetadataRepo.findOne({
      where: {
        id: createDto['modelMetadataId']
      },
    });
    createDto['mediaStorageProviderMetadata'] = await this.mediaStorageProviderMetadataRepo.findOne({
      where: {
        id: createDto['mediaStorageProviderMetadataId']
      },
    });
    createDto['mediaStorageProviderMetadata'] = createDto['mediaStorageProviderMetadata'] || createDto['fieldMetadata']?.mediaStorageProvider;
    createDto['modelMetadata'] = createDto['modelMetadata'] || createDto['fieldMetadata']?.model;

    if (!createDto['mediaStorageProviderMetadata']) {
      throw new NotFoundException('Media storage provider metadata not found');
    }

    const savedMedias = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const storageProvider = createDto.mediaStorageProviderMetadata as MediaStorageProviderMetadata;

      switch (storageProvider.type) {
        case MediaStorageProviderType.Filesystem:
          const fileStoragePath = this.getFullFilePathForDisk(this.getFileName(file), storageProvider);
          await this.diskFileService.copy(file.path, fileStoragePath);
          createDto['relativeUri'] = this.getFileName(file);
          break;
        case MediaStorageProviderType.AwsS3:
          const fileName = this.getFileName(file);
          const bucketName = storageProvider.bucketName;
          const region = this.getEffectiveRegion(storageProvider.region);

          // Read file from disk and upload to S3
          const fileData = await this.diskFileService.read(file.path);
          await this.s3FileService.write(`${bucketName}:${fileName}`, fileData, { contentType: file.mimetype, region });

          createDto['relativeUri'] = fileName;
          break;
        default:
          break;
      }
      // Delete temp file from disk
      await this.diskFileService.delete(file.path);

      createDto['isPublic'] = this.resolveStoredIsPublic(createDto['isPublic'], storageProvider);
      const media = this.repo.create(createDto as Partial<Media>) as Media;
      const savedMedia = await this.repo.save(media);
      savedMedia.isPublic = this.resolveStoredIsPublic(savedMedia.isPublic, storageProvider);
      savedMedias.push(savedMedia)
    }
    return savedMedias
  }

  async remove(id: number) {
    // const lov = await this.findOne(id);
    const media = await this.repo.findOne({
      where: {
        id: id,
      },
      relations: ['mediaStorageProviderMetadata', 'fieldMetadata', 'fieldMetadata.model', 'fieldMetadata.mediaStorageProvider'],
    });
    const modelEntity = await this.modelMetadataRepo.findOne({
      where: {
        id: media.entityId,
      }
    }
    );
    const storageProviderType = media.mediaStorageProviderMetadata.type as MediaStorageProviderType;
    const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);
    await storageProvider.delete(modelEntity, media.fieldMetadata);

    return this.repo.remove(media);
  }

  async fileDownloadStream(media: Media): Promise<{ stream: Readable | null, fileName: string, mimeType: string, redirectUrl?: string }> {
    const loadedMedia = await this.repo.findOne({
      where: { id: media.id },
      relations: ['mediaStorageProviderMetadata'],
    });

    if (!loadedMedia || !loadedMedia.mediaStorageProviderMetadata) {
      throw new NotFoundException(`Media with id ${media.id} not found`);
    }

    const fileName = loadedMedia.originalFileName || path.basename(loadedMedia.relativeUri || `${loadedMedia.id}`);
    const mimeType = loadedMedia.mimeType || 'application/octet-stream';

    switch (loadedMedia.mediaStorageProviderMetadata.type as MediaStorageProviderType) {
      case MediaStorageProviderType.Filesystem:
        return {
          stream: await this.diskFileService.readStream(
            this.getFullFilePathForDisk(loadedMedia.relativeUri, loadedMedia.mediaStorageProviderMetadata),
          ),
          fileName,
          mimeType,
        };
      default:
        throw new Error(`Unsupported media storage provider type ${loadedMedia.mediaStorageProviderMetadata.type}`);
    }
  }

  async delete(id: number, solidRequestContext: any = {}) {
    const media = await this.repo.findOne({
      where: { id },
      relations: ['mediaStorageProviderMetadata'],
    });

    const result = await super.delete(id, solidRequestContext);

    if (media) {
      await this.deletePhysicalFile(media);
    }

    return result;
  }

  async deleteMany(ids: number[], solidRequestContext: any = {}) {
    const mediaRecords = await this.repo.find({
      where: {
        id: In(ids),
      },
      relations: ['mediaStorageProviderMetadata'],
    });

    const result = await super.deleteMany(ids, solidRequestContext);

    for (const media of mediaRecords) {
      await this.deletePhysicalFile(media);
    }

    return result;
  }

  private async decorateMediaRecords(medias: Media[]): Promise<void> {
    for (const media of medias) {
      await this.decorateMediaRecord(media);
    }
  }

  private async decorateMediaRecord(media: Media): Promise<void> {
    const mediaStorageProvider = await this.resolveMediaStorageProvider(media);
    media.isPublic = this.resolveStoredIsPublic(media.isPublic, mediaStorageProvider);
    media.relativeUri = await this.resolveMediaUrl(media, mediaStorageProvider);
  }

  private async resolveMediaUrl(media: Media, mediaStorageProvider?: MediaStorageProviderMetadata): Promise<string> {
    const resolvedMediaStorageProvider = mediaStorageProvider || await this.resolveMediaStorageProvider(media);
    const isPublic = this.resolveStoredIsPublic(media.isPublic, resolvedMediaStorageProvider);

    if (isPublic === false) {
      return this.mediaDownloadUrlService.resolveDownloadUrl(media.id, media.relativeUri, resolvedMediaStorageProvider);
    }

    if (resolvedMediaStorageProvider?.type === MediaStorageProviderType.Filesystem) {
      return this.diskFileService.getUrl(this.getFullFilePathForDisk(media.relativeUri, resolvedMediaStorageProvider));
    }

    if (resolvedMediaStorageProvider?.type === MediaStorageProviderType.AwsS3) {
      return this.s3FileService.getUrl(
        `${resolvedMediaStorageProvider.bucketName}:${media.relativeUri}`,
        { region: this.getEffectiveRegion(resolvedMediaStorageProvider.region), expiresIn: 0 },
      );
    }

    return media.relativeUri;
  }

  private async deletePhysicalFile(media: Media): Promise<void> {
    if (!media?.relativeUri) {
      return;
    }

    try {
      const mediaStorageProvider = await this.resolveMediaStorageProvider(media);
      if (!mediaStorageProvider) {
        return;
      }

      switch (mediaStorageProvider.type as MediaStorageProviderType) {
        case MediaStorageProviderType.Filesystem:
          await this.diskFileService.delete(this.getFullFilePathForDisk(media.relativeUri, mediaStorageProvider));
          return;
        case MediaStorageProviderType.AwsS3:
          await this.s3FileService.delete(
            `${mediaStorageProvider.bucketName}:${media.relativeUri}`,
            { region: this.getEffectiveRegion(mediaStorageProvider.region) },
          );
          return;
        default:
          this.logger.warn(`Skipping physical delete for unsupported media storage provider type ${mediaStorageProvider.type}`);
      }
    } catch (error: any) {
      const message = error?.message ?? String(error);
      this.logger.warn(`Failed to delete physical media file for media id ${media.id}: ${message}`);
    }
  }

  private getFullFilePathForDisk(fileName: string, mediaStorageProvider?: MediaStorageProviderMetadata): string {
    const publicBase = this.settingService.getConfigValue<SolidCoreSetting>("fileStorageDir") || DEFAULT_MEDIA_FILE_STORAGE_DIR;
    const privateBase = DEFAULT_PRIVATE_MEDIA_STORAGE_DIR;
    const providerBase = mediaStorageProvider?.localPath || (mediaStorageProvider?.isPublic === false ? privateBase : publicBase);
    if ( path.isAbsolute(fileName) || fileName.startsWith(`${publicBase}/`) || fileName.startsWith(`${privateBase}/`) || (!!mediaStorageProvider?.localPath && fileName.startsWith(`${mediaStorageProvider.localPath}/`))) {
      return fileName;
    }
    return `${providerBase}/${fileName}`;
  }

  private getFileName(file: Express.Multer.File): string {
    return `${file.filename}-${file.originalname}`;
  }

  private getEffectiveRegion(providerRegion?: string): string | undefined {
    return providerRegion || this.configService.get('S3_AWS_REGION_NAME');
  }

  private async resolveMediaStorageProvider(media: Media): Promise<MediaStorageProviderMetadata | undefined> {
    if (media.mediaStorageProviderMetadata) {
      return media.mediaStorageProviderMetadata;
    }

    if (!media.id) {
      return undefined;
    }

    const loadedMedia = await this.repo.findOne({
      where: { id: media.id },
      relations: ['mediaStorageProviderMetadata'],
    });

    return loadedMedia?.mediaStorageProviderMetadata;
  }

  private resolveIsPublic(mediaStorageProvider?: MediaStorageProviderMetadata): boolean | undefined {
    if (!mediaStorageProvider) {
      return undefined;
    }
    return mediaStorageProvider.isPublic !== false;
  }

  private resolveStoredIsPublic(currentValue: boolean | undefined, mediaStorageProvider?: MediaStorageProviderMetadata): boolean | undefined {
    if (typeof currentValue === 'boolean') {
      return currentValue;
    }
    return this.resolveIsPublic(mediaStorageProvider);
  }
}
