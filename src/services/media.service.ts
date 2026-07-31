import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In, Not } from 'typeorm';
import * as path from 'path';
import { Readable } from 'stream';

import { ConfigService } from '@nestjs/config';
import { CRUDService } from 'src/services/crud.service';
import { DiskFileService, S3FileService } from 'src/services/file';
import { classify } from 'src/helpers/string.helper';
import { MediaDownloadUrlService } from 'src/services/media-download-url.service';


import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { BasicFilterDto } from 'src/dtos/basic-filters.dto';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { Media } from 'src/entities/media.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { MediaFieldCrudManager, SolidMediaType } from 'src/helpers/field-crud-managers/MediaFieldCrudManager';
import { FieldMetadataRepository } from 'src/repository/field-metadata.repository';
import { MediaStorageProviderMetadataRepository } from 'src/repository/media-storage-provider-metadata.repository';
import { MediaRepository } from 'src/repository/media.repository';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { buildDiskMediaPath, getEffectiveS3Region, resolveMediaIsPublic, } from 'src/services/media-storage.utils';
import { getMediaStorageProvider } from "./mediaStorageProviders";

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

    createDto['fieldMetadata'].mediaStorageProvider = createDto['mediaStorageProviderMetadata'];

    const validator = new MediaFieldCrudManager({
      type: createDto['fieldMetadata']?.type as SolidMediaType,
      required: true,
      fieldName: 'files',
      mediaMaxSizeKb: createDto['fieldMetadata']?.mediaMaxSizeKb,
      mediaTypes: createDto['fieldMetadata']?.mediaTypes || [],
      isUpdate: false,
    });
    const validationErrors = validator.validate(createDto, files);
    if (validationErrors.length > 0) {
      throw new BadRequestException(validationErrors.map(error => error.error).join(', '));
    }

    const storageProviderType = createDto['mediaStorageProviderMetadata'].type as MediaStorageProviderType;
    const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);

    return storageProvider.store(files, { id: Number(createDto['entityId']) }, createDto['fieldMetadata']);
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
            buildDiskMediaPath(loadedMedia.relativeUri, this.settingService, loadedMedia.mediaStorageProviderMetadata),
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
      relations: ['mediaStorageProviderMetadata', 'modelMetadata'],
    });

    if (media) {
      await this.assertMediaDeletable([media]);
    }

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
      relations: ['mediaStorageProviderMetadata', 'modelMetadata'],
    });

    await this.assertMediaDeletable(mediaRecords);

    const result = await super.deleteMany(ids, solidRequestContext);

    for (const media of mediaRecords) {
      await this.deletePhysicalFile(media);
    }

    return result;
  }

  /**
   * Media belonging to a published draft/publish-enabled record must survive edits made to
   * later drafts (see DraftPublishHelperService.cloneMediaForVersion) - deleting it directly
   * would strip the published version's media out from under it. Mirrors the equivalent
   * entity-level guard in DraftPublishHelperService.assertDraftPublishDeleteAllowed.
   */
  private async assertMediaDeletable(mediaRecords: Media[]): Promise<void> {
    const blockedIds: number[] = [];

    for (const media of mediaRecords) {
      if (!media.modelMetadata?.draftPublishWorkflow) continue;

      const entityRepository = this.entityManager.getRepository(classify(media.modelMetadata.singularName));
      const owningEntity = await entityRepository.findOne({ where: { id: media.entityId } as any });

      if (owningEntity && (owningEntity as any).isPublished === true) {
        blockedIds.push(media.id);
      }
    }

    if (blockedIds.length > 0) {
      throw new BadRequestException(
        'Media belonging to a published record cannot be deleted. Edit the record to create a draft first'
      );
    }
  }

  private async decorateMediaRecords(medias: Media[]): Promise<void> {
    for (const media of medias) {
      await this.decorateMediaRecord(media);
    }
  }

  private async decorateMediaRecord(media: Media): Promise<void> {
    const mediaStorageProvider = await this.resolveMediaStorageProvider(media);
    media.relativeUri = await this.resolveMediaUrl(media, mediaStorageProvider);
  }

  private async resolveMediaUrl(media: Media, mediaStorageProvider?: MediaStorageProviderMetadata): Promise<string> {
    const resolvedMediaStorageProvider = mediaStorageProvider || await this.resolveMediaStorageProvider(media);
    const isPublic = resolveMediaIsPublic(resolvedMediaStorageProvider);

    if (isPublic === false) {
      return this.mediaDownloadUrlService.getPrivateUrl(media.id, media.relativeUri, resolvedMediaStorageProvider);
    }

    if (resolvedMediaStorageProvider?.type === MediaStorageProviderType.Filesystem) {
      return this.diskFileService.getUrl(buildDiskMediaPath(media.relativeUri, this.settingService, resolvedMediaStorageProvider));
    }

    if (resolvedMediaStorageProvider?.type === MediaStorageProviderType.AwsS3) {
      return this.s3FileService.getUrl(
        `${resolvedMediaStorageProvider.bucketName}:${media.relativeUri}`,
        { region: getEffectiveS3Region(this.configService, resolvedMediaStorageProvider.region), expiresIn: 0 },
      );
    }

    return media.relativeUri;
  }

  private async deletePhysicalFile(media: Media): Promise<void> {
    if (!media?.relativeUri) {
      return;
    }

    try {
      // Draft/publish versioning may clone a Media row that reuses the same
      // relativeUri (see DraftPublishHelperService.cloneMediaForVersion) instead of
      // duplicating the underlying file. Skip the physical delete if another row
      // still references it.
      const stillReferenced = await this.repo.exists({
        where: { relativeUri: media.relativeUri, id: Not(media.id) },
      });
      if (stillReferenced) {
        return;
      }

      const mediaStorageProvider = await this.resolveMediaStorageProvider(media);
      if (!mediaStorageProvider) {
        return;
      }

      switch (mediaStorageProvider.type as MediaStorageProviderType) {
        case MediaStorageProviderType.Filesystem:
          await this.diskFileService.delete(buildDiskMediaPath(media.relativeUri, this.settingService, mediaStorageProvider));
          return;
        case MediaStorageProviderType.AwsS3:
          await this.s3FileService.delete(
            `${mediaStorageProvider.bucketName}:${media.relativeUri}`,
            { region: getEffectiveS3Region(this.configService, mediaStorageProvider.region) },
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
}
