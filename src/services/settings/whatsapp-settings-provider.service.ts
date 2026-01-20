import { Injectable } from "@nestjs/common";
import { Environment } from "src/decorators/disallow-in-production.decorator";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreWhatsappSettingsProvider implements ISettingsProvider {

  getSettings() {

    return [

      { namespace: "whatsapp", key: "whatsappProvider", value: process.env.COMMON_WHATSAPP_PROVIDER, level: SettingLevel.SystemAdminReadonly },
      { namespace: "whatsapp", key: "msg91WhatsappUrl", value: process.env.COMMON_WHATSAPP_API_URL, level: SettingLevel.SystemAdminReadonly },
      { namespace: "whatsapp", key: "msg91WhatsappApiKey", value: process.env.COMMON_WHATSAPP_API_KEY, level: SettingLevel.SystemAdminReadonly },
      { namespace: "whatsapp", key: "msg91WhatsappIntegratedNumber", value: process.env.COMMON_WHATSAPP_INTEGRATED_NUMBER, level: SettingLevel.SystemAdminReadonly },

    ];

  }
}
