import { Injectable } from "@nestjs/common";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreDefaultSettingsProvider implements ISettingsProvider {

  getSettings() {
    return [
      { namespace: "default", key: "iamGoogleOAuthEnabled", value: false, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "authPagesLayout", value: "center", level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "authPagesTheme", value: "light", level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "appLogo", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "companylogo", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "favicon", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "appLogoPosition", value: "in_form_view", level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "showAuthContent", value: false, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "appTitle", value: process.env.SOLID_APP_NAME || "Solid App", level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "appSubtitle", value: process.env.SOLID_APP_SUBTITLE || "", level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "appDescription", value: process.env.SOLID_APP_DESCRIPTION || "", level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "showLegalLinks", value: false, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "appTnc", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "appPrivacyPolicy", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "enableDarkMode", value: true, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "copyright", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "enableUsername", value: true, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "enabledNotification", value: true, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "contactSupportEmail", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "contactSupportDisplayName", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "contactSupportIcon", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "authScreenRightBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "authScreenLeftBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "authScreenCenterBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
      {
        namespace: "default", key: "solidXGenAiCodeBuilderConfig", value: JSON.stringify({
          defaultProvider: "",
          availableProviders: []
        }), level: SettingLevel.SystemAdminEditable
      },
      { namespace: "default", key: "mcpEnabled", value: process.env.MCP_ENABLED, level: SettingLevel.SystemAdminReadonly },
      { namespace: "default", key: "mcpServerUrl", value: process.env.MCP_SERVER_URL, level: SettingLevel.SystemAdminReadonly },
      { namespace: "default", key: "mcpApiKey", value: process.env.MCP_API_KEY, level: SettingLevel.SystemAdminReadonly },

      { namespace: "default", key: "dateTimeFormat", value: process.env.DATE_TIME_FORMAT || "YYYY-MM-DD HH:mm:ss", level: SettingLevel.SystemAdminEditable },
      { namespace: "default", key: "dateFormat", value: process.env.DATE_FORMAT || "YYYY-MM-DD", level: SettingLevel.SystemAdminEditable }
    ];
  }
}

