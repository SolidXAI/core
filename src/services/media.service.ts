import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

import { ConfigService } from '@nestjs/config';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';


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
    readonly fileService: FileService,
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
        if (media.mediaStorageProviderMetadata?.type === MediaStorageProviderType.Filesystem) {
          media.relativeUri = `${this.settingService.getConfigValue<SolidCoreSetting>("baseUrl")}/${await this.getFileSysytemFullFilePath(media.relativeUri)}`;
        } else if (media.mediaStorageProviderMetadata?.type === MediaStorageProviderType.AwsS3) {
          media.relativeUri = this.getAwsS3FullFilePath(
            media.relativeUri,
            media.mediaStorageProviderMetadata.bucketName,
            media.mediaStorageProviderMetadata.region
          );
        }
      }
      // data.records.forEach((media: Media) => {
      //       if (media.mediaStorageProviderMetadata?.type === MediaStorageProviderType.Filesystem) {
      //   media.relativeUri = `${process.env.BASE_URL}/${await this.getFileSysytemFullFilePath(media.relativeUri)}`;
      // } else if (media.mediaStorageProviderMetadata?.type === MediaStorageProviderType.AwsS3) {
      //   media.relativeUri = this.getAwsS3FullFilePath(
      //     media.relativeUri,
      //     media.mediaStorageProviderMetadata.bucketName,
      //     media.mediaStorageProviderMetadata.region
      //   );
      // }
      // });
    }
    if (data.groupRecords) {

      for (const group of data.groupRecords) {
        for (const media of group.groupData.records) {
          if (media.mediaStorageProviderMetadata?.type === MediaStorageProviderType.Filesystem) {
            media.relativeUri = `${this.settingService.getConfigValue<SolidCoreSetting>("baseUrl")}/${await this.getFileSysytemFullFilePath(media.relativeUri)}`;
          }
          else if (media.mediaStorageProviderMetadata?.type === MediaStorageProviderType.AwsS3) {
            media.relativeUri = this.getAwsS3FullFilePath(media.relativeUri, media.mediaStorageProviderMetadata.bucketName, media.mediaStorageProviderMetadata.region);
          }
        }
      }

      // data.groupRecords.forEach((group) => {
      //   group.groupData.records.forEach((media) => {
      //     if (media.mediaStorageProviderMetadata?.type === MediaStorageProviderType.Filesystem) {
      //       media.relativeUri = `${process.env.BASE_URL}/${this.getFileSysytemFullFilePath(media.relativeUri)}`;
      //     }
      //     else if (media.mediaStorageProviderMetadata?.type === MediaStorageProviderType.AwsS3) {
      //       media.relativeUri = this.getAwsS3FullFilePath(media.relativeUri, media.mediaStorageProviderMetadata.bucketName, media.mediaStorageProviderMetadata.region);
      //     }
      //   });
      // });
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
          const fileStoragePath = await this.getFileSysytemFullFilePath(this.getFileName(file));
          await this.fileService.copyFile(file.path, fileStoragePath);
          createDto['relativeUri'] = this.getFileName(file);
          break;
        case MediaStorageProviderType.AwsS3:
          const fileName = this.getFileName(file);
          let awsFileUrl;
          if (createDto.mediaStorageProviderMetadata.isPublic === true) {
            awsFileUrl = await this.fileService.copyToS3WithPublic(file.path, file.mimetype, fileName, createDto.mediaStorageProviderMetadata.bucketName,);
          } else {
            awsFileUrl = await this.fileService.copyToS3(file.path, file.mimetype, fileName, createDto.mediaStorageProviderMetadata.bucketName,);
          }
          // createDto['relativeUri'] = this.getAwsS3FullFilePath(awsFileUrl, createDto.mediaStorageProviderMetadata.bucketName, createDto.mediaStorageProviderMetadata.region);
          createDto['relativeUri'] = awsFileUrl
          break;
        default:
          break;
      }
      await this.fileService.deleteFile(file.path);

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
    // if (media.mediaStorageProviderMetadata.type === 'filesystem') {
    //     const fileStorageProvider = new FileStorageProvider(this.configService, this.fileService, this);

    //     await fileStorageProvider.delete(media, media.fieldMetadata);

    // } else if (media.mediaStorageProviderMetadata.type === 'aws-s3') {
    //     const fileStorageProvider = new FileS3StorageProvider(this.configService, this.fileService, this);
    //     await fileStorageProvider.delete(media, media.fieldMetadata);

    // } else {
    // }
    const storageProviderType = media.mediaStorageProviderMetadata.type as MediaStorageProviderType;
    const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);
    await storageProvider.delete(modelEntity, media.fieldMetadata);

    return this.repo.remove(media);
  }
  //TODO: Move this to a app builder config

  private async getFileSysytemFullFilePath(fileName: string): Promise<string> {
    const fileStorageDir = this.settingService.getConfigValue<SolidCoreSetting>("fileStorageDir");
    return `${fileStorageDir}/${fileName}`;
  }

  private getAwsS3FullFilePath(awsMediaurl: string, bucketName: string, regionName: string): string {
    // https://lunarismedia.s3.ap-south-1.amazonaws.com/LUNARIS_CP_REGISTRATION_CREATIVE.jpg
    return `https://${bucketName}.s3.${regionName}.amazonaws.com/${awsMediaurl}`;
  }

  private getFileName(file: Express.Multer.File): string {
    return `${file.filename}-${file.originalname}`;
  }

}
