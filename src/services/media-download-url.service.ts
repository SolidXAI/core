import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { S3FileService } from 'src/services/file';
import { getEffectiveS3Region } from 'src/services/media-storage.utils';
import { SettingService } from 'src/services/setting.service';
import type { SolidCoreSetting } from 'src/services/settings/default-settings-provider.service';

export const MEDIA_DOWNLOAD_TOKEN_AUDIENCE = 'media-download';
const DEFAULT_SIGNED_URL_EXPIRY_MINUTES = 60;

export interface MediaDownloadTokenPayload {
  mediaId: number;
}

@Injectable()
export class MediaDownloadUrlService {
  private readonly logger = new Logger(MediaDownloadUrlService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly s3FileService: S3FileService,
    private readonly settingService: SettingService,
    private readonly configService: ConfigService,
  ) { }

  async resolveDownloadUrl(mediaId: number, relativeUri: string, storageProvider?: MediaStorageProviderMetadata): Promise<string> {
    const expiryMinutes = storageProvider?.signedUrlExpiry ?? DEFAULT_SIGNED_URL_EXPIRY_MINUTES;

    if ((storageProvider?.type as MediaStorageProviderType) === MediaStorageProviderType.AwsS3) {
      if (storageProvider?.bucketName) {
        return this.s3FileService.getUrl(
          `${storageProvider.bucketName}:${relativeUri}`,
          { region: getEffectiveS3Region(this.configService, storageProvider.region), expiresIn: expiryMinutes * 60 },
        );
      }
      this.logger.warn(`Media id ${mediaId}: AwsS3 provider missing bucketName; falling back to app-hosted token URL`);
    }

    // Filesystem (or misconfigured S3) has no native presigned-URL mechanism, so mint our
    // own short-lived token and embed it in the download URL - the token alone authorizes
    // the request (see MediaSignedUrlGuard), so it works in a plain <img src> with no
    // Authorization header needed.
    const token = await this.mintDownloadToken(mediaId, expiryMinutes);
    const downloadPath = `/api/media/${mediaId}/download?token=${token}`;
    const baseUrl = this.settingService.getConfigValue<SolidCoreSetting>('baseUrl');
    return `${String(baseUrl).replace(/\/+$/, '')}${downloadPath}`;
  }

  async verifyDownloadToken(token: string): Promise<MediaDownloadTokenPayload> {
    return this.jwtService.verifyAsync<MediaDownloadTokenPayload>(token, {
      secret: this.settingService.getConfigValue<SolidCoreSetting>('secret'),
      audience: MEDIA_DOWNLOAD_TOKEN_AUDIENCE,
    });
  }

  private mintDownloadToken(mediaId: number, expiryMinutes: number): Promise<string> {
    const payload: MediaDownloadTokenPayload = { mediaId };
    return this.jwtService.signAsync(payload, {
      secret: this.settingService.getConfigValue<SolidCoreSetting>('secret'),
      audience: MEDIA_DOWNLOAD_TOKEN_AUDIENCE,
      expiresIn: expiryMinutes * 60,
    });
  }
}
