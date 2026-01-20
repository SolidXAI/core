import { Injectable } from "@nestjs/common";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreAwsS3SettingsProvider  implements ISettingsProvider {

  getSettings() {

    return [
      { namespace: "awsS3", key: "S3_AWS_ACCESS_KEY", value: process.env.S3_AWS_ACCESS_KEY, level: SettingLevel.SystemAdminReadonly },
      { namespace: "awsS3", key: "S3_AWS_SECRET_KEY", value: process.env.S3_AWS_SECRET_KEY, level: SettingLevel.SystemAdminReadonly },
      { namespace: "awsS3", key: "S3_AWS_REGION_NAME", value: process.env.S3_AWS_REGION_NAME, level: SettingLevel.SystemAdminReadonly },
    ];

  }
}
