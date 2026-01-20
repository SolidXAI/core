import { Injectable } from "@nestjs/common";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreWhatsappSettingsProvider implements ISettingsProvider {

  getSettings() {
    return [
      { key: "whatsappProvider", value: process.env.COMMON_WHATSAPP_PROVIDER, level: SettingLevel.SystemAdminReadonly },
      { key: "msg91WhatsappUrl", value: process.env.COMMON_WHATSAPP_API_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "msg91WhatsappApiKey", value: process.env.COMMON_WHATSAPP_API_KEY, level: SettingLevel.SystemAdminReadonly },
      { key: "msg91WhatsappIntegratedNumber", value: process.env.COMMON_WHATSAPP_INTEGRATED_NUMBER, level: SettingLevel.SystemAdminReadonly },
    ];
  }
}
