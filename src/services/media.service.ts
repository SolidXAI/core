import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import * as path from 'path';
import { DEFAULT_MEDIA_FILE_STORAGE_DIR } from "src/services/settings/default-settings-provider.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

import { ConfigService } from '@nestjs/config';
import { CRUDService } from 'src/services/crud.service';
import { DiskFileService, S3FileService } from 'src/services/file';


import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { BasicFilterDto } from 'src/dtos/basic-filters.dto';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { Media } from 'src/entities/media.entity';
import { FieldMetadataRepository } from 'src/repository/field-metadata.repository';
import { MediaStorageProviderMetadataRepository } from 'src/repository/media-storage-provider-metadata.repository';
import { MediaRepository } from 'src/repository/media.repository';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { getMediaStorageProvider } from "./mediaStorageProviders";


@Injectable()
export class MediaService extends CRUDService<Media> {
  constructor(
    readonly configService: ConfigService,
    readonly diskFileService: DiskFileService,
    readonly s3FileService: S3FileService,
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

      for (const media of data.records) {
        const mediaStorageProvider = media.mediaStorageProviderMetadata;

        if (mediaStorageProvider?.type === MediaStorageProviderType.Filesystem) {
          media.relativeUri = await this.diskFileService.getUrl(this.getFullFilePathForDisk(media.relativeUri));
        } else if (mediaStorageProvider?.type === MediaStorageProviderType.AwsS3) {
          media.relativeUri = await this.s3FileService.getUrl(`${mediaStorageProvider.bucketName}:${media.relativeUri}`, { region: mediaStorageProvider.region });
        }
      }
    }
    if (data.groupRecords) {

      for (const group of data.groupRecords) {
        for (const media of group.groupData.records) {
          const mediaStorageProvider = media.mediaStorageProviderMetadata;

          if (mediaStorageProvider?.type === MediaStorageProviderType.Filesystem) {
            media.relativeUri = await this.diskFileService.getUrl(this.getFullFilePathForDisk(media.relativeUri));
          }
          else if (mediaStorageProvider?.type === MediaStorageProviderType.AwsS3) {
            media.relativeUri = await this.s3FileService.getUrl(`${mediaStorageProvider.bucketName}:${media.relativeUri}`, { region: mediaStorageProvider.region });
          }
        }
      }
    }
    return data
  }

  async upload(createDto: any, files: Array<Express.Multer.File>) {

    if (!files) {
      throw new NotFoundException(ERROR_MESSAGES.FILE_NOT_FOUND);

    }
    const savedMedias = [];
    for (let i = 0; i < files.length; i++) {

      createDto['fieldMetadata'] = await this.fieldMetadataRepo.findOne({
        where: {
          id: createDto['fieldMetadataId']
        },
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

      const file = files[i];

      switch (createDto.mediaStorageProviderMetadata.type) {
        case MediaStorageProviderType.Filesystem:
          const fileStoragePath = this.getFullFilePathForDisk(this.getFileName(file));
          await this.diskFileService.copy(file.path, fileStoragePath);
          createDto['relativeUri'] = this.getFileName(file);
          break;
        case MediaStorageProviderType.AwsS3:
          const fileName = this.getFileName(file);
          const bucketName = createDto.mediaStorageProviderMetadata.bucketName;

          // Read file from disk and upload to S3
          const fileData = await this.diskFileService.read(file.path);
          await this.s3FileService.write(`${bucketName}:${fileName}`, fileData, { contentType: file.mimetype });

          createDto['relativeUri'] = fileName;
          break;
        default:
          break;
      }
      // Delete temp file from disk
      await this.diskFileService.delete(file.path);

      const media = this.repo.create(createDto);
      const savedMedia = await this.repo.save(media);
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

  private getFullFilePathForDisk(fileName: string): string {
    const base = this.settingService.getConfigValue<SolidCoreSetting>("fileStorageDir")
      || DEFAULT_MEDIA_FILE_STORAGE_DIR;
    if (path.isAbsolute(fileName) || fileName.startsWith(`${base}/`)) {
      return fileName;
    }
    return `${base}/${fileName}`;
  }

  private getFileName(file: Express.Multer.File): string {
    return `${file.filename}-${file.originalname}`;
  }

}
