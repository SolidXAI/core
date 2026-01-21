import { Injectable } from "@nestjs/common";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreDefaultSettingsProvider implements ISettingsProvider {

  getSettings() {
    return [
      { key: "iamGoogleOAuthEnabled", value: false, level: SettingLevel.SystemAdminEditable },
      { key: "authPagesLayout", value: "center", level: SettingLevel.SystemAdminEditable },
      { key: "authPagesTheme", value: "light", level: SettingLevel.SystemAdminEditable },
      { key: "appLogo", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "companylogo", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "favicon", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "appLogoPosition", value: "in_form_view", level: SettingLevel.SystemAdminEditable },
      { key: "showAuthContent", value: false, level: SettingLevel.SystemAdminEditable },
      { key: "appTitle", value: process.env.SOLID_APP_NAME || "Solid App", level: SettingLevel.SystemAdminEditable },
      { key: "appSubtitle", value: process.env.SOLID_APP_SUBTITLE || "", level: SettingLevel.SystemAdminEditable },
      { key: "appDescription", value: process.env.SOLID_APP_DESCRIPTION || "", level: SettingLevel.SystemAdminEditable },
      { key: "showLegalLinks", value: false, level: SettingLevel.SystemAdminEditable },
      { key: "appTnc", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "appPrivacyPolicy", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "enableDarkMode", value: true, level: SettingLevel.SystemAdminEditable },
      { key: "copyright", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "enableUsername", value: true, level: SettingLevel.SystemAdminEditable },
      { key: "enabledNotification", value: true, level: SettingLevel.SystemAdminEditable },
      { key: "contactSupportEmail", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "contactSupportDisplayName", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "contactSupportIcon", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "authScreenRightBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "authScreenLeftBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
      { key: "authScreenCenterBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
      {
        key: "solidXGenAiCodeBuilderConfig", value: JSON.stringify({
          defaultProvider: "",
          availableProviders: []
        }), level: SettingLevel.SystemAdminEditable
      },
      { key: "mcpEnabled", value: process.env.MCP_ENABLED, level: SettingLevel.SystemAdminReadonly },
      { key: "mcpServerUrl", value: process.env.MCP_SERVER_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "mcpApiKey", value: process.env.MCP_API_KEY, level: SettingLevel.SystemEnv },

      { key: "dateTimeFormat", value: process.env.DATE_TIME_FORMAT || "YYYY-MM-DD HH:mm:ss", level: SettingLevel.SystemAdminEditable },
      { key: "dateFormat", value: process.env.DATE_FORMAT || "YYYY-MM-DD", level: SettingLevel.SystemAdminEditable }
    ];
  }
}
