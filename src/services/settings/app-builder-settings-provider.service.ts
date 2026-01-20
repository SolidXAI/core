import { Injectable } from "@nestjs/common";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";

@SettingsProvider()
@Injectable()
export class SolidCoreAppBuilderSettingsProvider implements ISettingsProvider {

  getSettings() {

    const DEFAULT_MEDIA_UPLOAD_DIR = 'media-uploads';
    const DEFAULT_MEDIA_FILE_STORAGE_DIR = 'media-files-storage';

    return [
      { key: "moduleMetadataSeederFiles", value: process.env.AB_MODULE_METADATA_SEEDER_FILES ?? '', level: SettingLevel.SystemAdminReadonly },
      { key: "uploadDir", value: process.env.AB_MEDIA_UPLOAD_DIR ?? DEFAULT_MEDIA_UPLOAD_DIR, level: SettingLevel.SystemAdminReadonly },
      { key: "fileStorageDir", value: process.env.AB_MEDIA_FILE_STORAGE_DIR ?? DEFAULT_MEDIA_FILE_STORAGE_DIR, level: SettingLevel.SystemAdminReadonly },
    ];
  }
}
