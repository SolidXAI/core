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
      { namespace: "app-builder", key: "moduleMetadataSeederFiles", value: process.env.AB_MODULE_METADATA_SEEDER_FILES ?? '', level: SettingLevel.SystemAdminReadonly },
      { namespace: "app-builder", key: "uploadDir", value: process.env.AB_MEDIA_UPLOAD_DIR ?? DEFAULT_MEDIA_UPLOAD_DIR, level: SettingLevel.SystemAdminReadonly },
      { namespace: "app-builder", key: "fileStorageDir", value: process.env.AB_MEDIA_FILE_STORAGE_DIR ?? DEFAULT_MEDIA_FILE_STORAGE_DIR, level: SettingLevel.SystemAdminReadonly },
    ];

  }
}
