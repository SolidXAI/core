import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Not } from 'typeorm';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { Media } from 'src/entities/media.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { MediaRepository } from 'src/repository/media.repository';
import { DiskFileService, S3FileService } from 'src/services/file';
import { buildDiskMediaPath, getEffectiveS3Region } from 'src/services/media-storage.utils';
import { SettingService } from 'src/services/setting.service';

/**
 * The one place that removes a media row's physical file from storage, based on the
 * provider recorded on that row (not the field's provider).
 */
@Injectable()
export class MediaFileStorageService {
  private readonly logger = new Logger(MediaFileStorageService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly diskFileService: DiskFileService,
    private readonly s3FileService: S3FileService,
    private readonly settingService: SettingService,
    private readonly mediaRepository: MediaRepository,
  ) { }

  /**
   * Deletes the file behind `media`. Call this after the media row itself has been removed.
   *
   * - Skips the delete if another row still points at the same file (draft/publish versions
   *   share one file instead of duplicating it).
   * - Never throws: the row is already gone, so a storage failure is logged and the file is
   *   left behind rather than aborting the caller halfway through a batch.
   *
   * @returns true if the file was deleted
   */
  async deleteFile(media: Media, provider: MediaStorageProviderMetadata | undefined): Promise<boolean> {
    if (!media?.relativeUri) {
      return false;
    }

    try {
      const stillReferenced = await this.mediaRepository.exists({
        where: { relativeUri: media.relativeUri, id: Not(media.id) },
      });
      if (stillReferenced) {
        return false;
      }

      if (!provider) {
        this.logger.warn(`Media id ${media.id}: no storage provider found, so its file was not deleted`);
        return false;
      }

      switch (provider.type as MediaStorageProviderType) {
        case MediaStorageProviderType.Filesystem:
          await this.diskFileService.delete(buildDiskMediaPath(media.relativeUri, this.settingService, provider));
          return true;
        case MediaStorageProviderType.AwsS3:
          await this.s3FileService.delete(
            `${provider.bucketName}:${media.relativeUri}`,
            { region: getEffectiveS3Region(this.configService, provider.region) },
          );
          return true;
        default:
          this.logger.warn(`Media id ${media.id}: unsupported storage provider type ${provider.type}, so its file was not deleted`);
          return false;
      }
    } catch (error: any) {
      this.logger.warn(`Failed to delete physical media file for media id ${media.id}: ${error?.message ?? String(error)}`);
      return false;
    }
  }
}
