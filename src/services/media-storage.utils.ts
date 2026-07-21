import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { SettingService } from 'src/services/setting.service';
import { DEFAULT_MEDIA_FILE_STORAGE_DIR } from 'src/services/settings/default-settings-provider.service';
import type { SolidCoreSetting } from 'src/services/settings/default-settings-provider.service';

export const DEFAULT_PRIVATE_MEDIA_STORAGE_DIR = 'media-private-files-storage';

export interface MediaRecordCreateInput {
  entityId: number;
  modelMetadataId: number;
  mediaStorageProviderMetadataId: number;
  fieldMetadataId: number;
  relativeUri: string;
  mimeType?: string;
  fileSize?: number;
  originalFileName?: string;
  isPublic?: boolean;
}

// Builds the stored file name format shared by media storage implementations.
export function buildStoredMediaFileName(file: Pick<Express.Multer.File, 'filename' | 'originalname'>): string {
  return `${file.filename}-${file.originalname}`;
}

// Resolves the on-disk path for a media file based on settings and provider visibility.
export function buildDiskMediaPath(fileName: string,settingService: Pick<SettingService, 'getConfigValue'>,storageProvider?: Pick<MediaStorageProviderMetadata, 'localPath' | 'isPublic'>,): string {
  const publicBase = settingService.getConfigValue<SolidCoreSetting>('fileStorageDir') || DEFAULT_MEDIA_FILE_STORAGE_DIR;
  const privateBase = DEFAULT_PRIVATE_MEDIA_STORAGE_DIR;
  const providerBase = storageProvider?.localPath || (storageProvider?.isPublic === false ? privateBase : publicBase);

  if ( path.isAbsolute(fileName) || fileName.startsWith(`${publicBase}/`) || fileName.startsWith(`${privateBase}/`) || (!!storageProvider?.localPath && fileName.startsWith(`${storageProvider.localPath}/`))) {
    return fileName;
  }

  return `${providerBase}/${fileName}`;
}

// Returns the S3 region from the provider when present, otherwise falls back to app config.
export function getEffectiveS3Region(configService: Pick<ConfigService, 'get'>,providerRegion?: string,): string | undefined {
  return providerRegion || configService.get<string>('S3_AWS_REGION_NAME');
}

// Resolves the effective public/private flag for a media storage provider.
export function resolveMediaIsPublic(storageProvider?: Pick<MediaStorageProviderMetadata, 'isPublic'>,): boolean | undefined {
  if (!storageProvider) {
    return undefined;
  }

  return storageProvider.isPublic !== false;
}

// Preserves an explicit media visibility value or derives it from the storage provider.
export function resolveStoredMediaIsPublic(currentValue: boolean | undefined,storageProvider?:Pick<MediaStorageProviderMetadata, 'isPublic'>,): boolean | undefined {
  if (typeof currentValue === 'boolean') {
    return currentValue;
  }

  return resolveMediaIsPublic(storageProvider);
}

// Builds the shared media record payload used before saving media metadata to the database.
export function buildMediaRecordCreateInput(
  entityId: number,
  mediaFieldMetadata: Pick<FieldMetadata, 'id' | 'model'> & { model: { id: number } },
  storageProvider: Pick<MediaStorageProviderMetadata, 'id'>,
  overrides: Pick<MediaRecordCreateInput, 'relativeUri'>
    & Partial<Omit<MediaRecordCreateInput, 'entityId' | 'modelMetadataId' | 'mediaStorageProviderMetadataId' | 'fieldMetadataId' | 'relativeUri'>>,
): MediaRecordCreateInput {
  return {
    entityId,
    modelMetadataId: mediaFieldMetadata.model.id,
    mediaStorageProviderMetadataId: storageProvider.id,
    fieldMetadataId: mediaFieldMetadata.id,
    ...overrides,
  };
}
