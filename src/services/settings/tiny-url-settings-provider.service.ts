import { Injectable } from "@nestjs/common";
import { Environment } from "src/decorators/disallow-in-production.decorator";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreTinyUrlSettingsProvider implements ISettingsProvider {

  getSettings() {

    return [

      { key: "tinyUrlApiUrl", value: process.env.COMMON_SHORT_URL_API_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "tinyUrlApiKey", value: process.env.COMMON_SHORT_URL_API_KEY, level: SettingLevel.SystemEnv },
      { key: "tinyUrlDomain", value: process.env.COMMON_SHORT_URL_DOMAIN, level: SettingLevel.SystemAdminReadonly },
      { key: "tinyUrlEnabled", value: (process.env.COMMON_SHORT_URL_ENABLED ?? 'false') === 'true', level: SettingLevel.SystemAdminReadonly },

    ];

  }
}
