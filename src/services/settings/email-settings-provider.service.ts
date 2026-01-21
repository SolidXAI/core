import { Injectable } from "@nestjs/common";
import { Environment } from "src/decorators/disallow-in-production.decorator";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreEmailSettingsProvider implements ISettingsProvider {

  getSettings() {

    return [

      { key: "emailProvider", value: process.env.COMMON_EMAIL_PROVIDER ?? "SMTPEMailService", level: SettingLevel.SystemAdminReadonly },
      { key: "emailTemplateSeederFiles", value: process.env.COMMON_EMAIL_TEMPLATE_SEEDER_FILES, level: SettingLevel.SystemAdminReadonly },
      { key: "shouldQueueEmails", value: (process.env.COMMON_EMAIL_SHOULD_QUEUE ?? 'false') === 'true', level: SettingLevel.SystemAdminReadonly },
      { key: "smtpMailHost", value: process.env.COMMON_SMTP_EMAIL_SMTP_HOST, level: SettingLevel.SystemAdminReadonly },
      { key: "smtpMailPort", value: +(process.env.COMMON_SMTP_EMAIL_SMTP_PORT ?? 587), level: SettingLevel.SystemAdminReadonly },
      { key: "smtpMailUsername", value: process.env.COMMON_SMTP_EMAIL_USERNAME, level: SettingLevel.SystemAdminReadonly },
      { key: "smtpMailPassword", value: process.env.COMMON_SMTP_EMAIL_PASSWORD, level: SettingLevel.SystemEnv },
      { key: "smtpMailFrom", value: process.env.COMMON_SMTP_EMAIL_FROM ?? process.env.COMMON_EMAIL_FROM, level: SettingLevel.SystemAdminReadonly },
      { key: "apiMailKey", value: process.env.COMMON_API_EMAIL_KEY, level: SettingLevel.SystemEnv },
      { key: "apiMailFrom", value: process.env.COMMON_EMAIL_FROM, level: SettingLevel.SystemAdminReadonly },

    ];

  }
}
