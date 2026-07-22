import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
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
    private readonly settingService: SettingService,
  ) { }

  async resolveDownloadUrl(
    mediaId: number,
    relativeUri: string,
    storageProvider?: MediaStorageProviderMetadata,
  ): Promise<string> {
    const expiryMinutes = storageProvider?.signedUrlExpiry ?? DEFAULT_SIGNED_URL_EXPIRY_MINUTES;

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
