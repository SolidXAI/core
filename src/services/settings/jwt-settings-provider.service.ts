import { Injectable } from "@nestjs/common";
import { Environment } from "src/decorators/disallow-in-production.decorator";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreJwtSettingsProvider implements ISettingsProvider {

  getSettings() {
    const isProd = (process.env.ENV as Environment) === Environment.Production;

    return [

      /* ===================== JWT CONFIG ===================== */
      { namespace: "jwt", key: "secret", value: process.env.IAM_JWT_SECRET, level: SettingLevel.SystemEnv },
      { namespace: "jwt", key: "audience", value: process.env.IAM_JWT_TOKEN_AUDIENCE, level: SettingLevel.SystemEnv },
      { namespace: "jwt", key: "issuer", value: process.env.IAM_JWT_TOKEN_ISSUER, level: SettingLevel.SystemEnv },
      { namespace: "jwt", key: "accessTokenTtl", value: parseInt(process.env.IAM_JWT_ACCESS_TOKEN_TTL ?? (isProd ? "1200" : "86400"), 10,), level: SettingLevel.SystemEnv },
      { namespace: "jwt", key: "refreshTokenTtl", value: parseInt(process.env.IAM_JWT_REFRESH_TOKEN_TTL ?? "604800", 10), level: SettingLevel.SystemEnv },
    ];

  }
}
