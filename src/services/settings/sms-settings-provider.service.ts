import { Injectable } from "@nestjs/common";
import { Environment } from "src/decorators/disallow-in-production.decorator";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreSmsSettingsProvider implements ISettingsProvider {

  getSettings() {

    return [

      { namespace: "sms", key: "smsProvider", value: process.env.COMMON_SMS_PROVIDER, level: SettingLevel.SystemAdminReadonly },
      { namespace: "sms", key: "smsTemplateSeederFiles", value: process.env.COMMON_SMS_TEMPLATE_SEEDER_FILES, level: SettingLevel.SystemAdminReadonly },
      { namespace: "sms", key: "shouldQueueSms", value: (process.env.COMMON_SMS_SHOULD_QUEUE ?? 'false') === 'true', level: SettingLevel.SystemAdminReadonly },
      { namespace: "sms", key: "msg91SmsUrl", value: process.env.COMMON_MSG91_SMS_URL, level: SettingLevel.SystemAdminReadonly },
      { namespace: "sms", key: "msg91SmsApiKey", value: process.env.COMMON_MSG91_SMS_API_KEY, level: SettingLevel.SystemAdminReadonly },
      { namespace: "sms", key: "twilioAccountSid", value: process.env.COMMON_TWILIO_ACCOUNT_SID, level: SettingLevel.SystemAdminReadonly },
      { namespace: "sms", key: "twilioAuthToken", value: process.env.COMMON_TWILIO_AUTH_TOKEN, level: SettingLevel.SystemAdminReadonly },
      { namespace: "sms", key: "twilioNumber", value: process.env.COMMON_TWILIO_NUMBER, level: SettingLevel.SystemAdminReadonly }
    ];

  }
}
