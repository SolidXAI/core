import { Injectable } from "@nestjs/common";
import { Environment } from "src/decorators/disallow-in-production.decorator";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreGoogleOAuthSettingsProvider implements ISettingsProvider {

  getSettings() {
    const isProd = (process.env.ENV as Environment) === Environment.Production;

    return [

      { key: "clientID", value: process.env.IAM_GOOGLE_OAUTH_CLIENT_ID, level: SettingLevel.SystemEnv },
      { key: "clientSecret", value: process.env.IAM_GOOGLE_OAUTH_CLIENT_SECRET, level: SettingLevel.SystemEnv },
      { key: "callbackURL", value: process.env.IAM_GOOGLE_OAUTH_CALLBACK_URL, level: SettingLevel.SystemEnv },
      { key: "redirectURL", value: process.env.IAM_GOOGLE_OAUTH_REDIRECT_URL, level: SettingLevel.SystemEnv },
      { key: "iamGoogleOAuthEnabled", value: false, level: SettingLevel.SystemAdminEditable },

    ];

  }
}
