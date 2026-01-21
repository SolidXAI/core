import { Injectable } from "@nestjs/common";
import { Environment } from "src/decorators/disallow-in-production.decorator";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";

const DEFAULT_MEDIA_UPLOAD_DIR = 'media-uploads';
const DEFAULT_MEDIA_FILE_STORAGE_DIR = 'media-files-storage';

@SettingsProvider()
@Injectable()
export class SolidCoreDefaultSettingsProvider implements ISettingsProvider {

  getSettings() {
    const isProd = (process.env.ENV as Environment) === Environment.Production;

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
      { key: "dateFormat", value: process.env.DATE_FORMAT || "YYYY-MM-DD", level: SettingLevel.SystemAdminEditable },
      { key: "baseUrl", value: process.env.BASE_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "solidAppWebsiteUrl", value: process.env.SOLID_APP_WEBSITE_URL, level: SettingLevel.SystemAdminEditable },

      // app-builder-settings-provider.service.ts, app-builder.config.ts
      { key: "moduleMetadataSeederFiles", value: process.env.AB_MODULE_METADATA_SEEDER_FILES ?? '', level: SettingLevel.SystemAdminReadonly },
      { key: "uploadDir", value: process.env.AB_MEDIA_UPLOAD_DIR ?? DEFAULT_MEDIA_UPLOAD_DIR, level: SettingLevel.SystemAdminReadonly },
      { key: "fileStorageDir", value: process.env.AB_MEDIA_FILE_STORAGE_DIR ?? DEFAULT_MEDIA_FILE_STORAGE_DIR, level: SettingLevel.SystemAdminReadonly },

      // aws-s3-settings-provider.service.ts
      { key: "S3_AWS_ACCESS_KEY", value: process.env.S3_AWS_ACCESS_KEY, level: SettingLevel.SystemEnv },
      { key: "S3_AWS_SECRET_KEY", value: process.env.S3_AWS_SECRET_KEY, level: SettingLevel.SystemEnv },
      { key: "S3_AWS_REGION_NAME", value: process.env.S3_AWS_REGION_NAME, level: SettingLevel.SystemAdminReadonly },

      // email-settings-provider.service.ts
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

      // genai-settings-provider.service.ts
      { key: "ragServerUrl", value: process.env.GENAI_RAG_SERVER_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "ragServerLogin", value: process.env.GENAI_RAG_SERVER_LOGIN, level: SettingLevel.SystemEnv },
      { key: "ragServerPassword", value: process.env.GENAI_RAG_SERVER_PASSWORD, level: SettingLevel.SystemEnv },
      { key: "mcpPythonExecutable", value: process.env.MCP_PYTHON_EXECUTABLE, level: SettingLevel.SystemEnv },
      { key: "mcpClient", value: process.env.MCP_CLIENT, level: SettingLevel.SystemEnv },
      { key: "mcpRestartTouchFile", value: process.env.MCP_RESTART_TOUCH_FILE || "tmp/restart.touch", level: SettingLevel.SystemEnv },

      // google-oauth-settings-provider.service.ts
      { key: "clientID", value: process.env.IAM_GOOGLE_OAUTH_CLIENT_ID, level: SettingLevel.SystemAdminReadonly },
      { key: "clientSecret", value: process.env.IAM_GOOGLE_OAUTH_CLIENT_SECRET, level: SettingLevel.SystemEnv },
      { key: "callbackURL", value: process.env.IAM_GOOGLE_OAUTH_CALLBACK_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "redirectURL", value: process.env.IAM_GOOGLE_OAUTH_REDIRECT_URL, level: SettingLevel.SystemAdminReadonly },

      // iam-settings-provider.service.ts
      { key: "passwordLessAuth", value: (process.env.IAM_PASSWORD_LESS_AUTH?.trim() ?? 'false') === 'true', level: SettingLevel.SystemAdminEditable },
      { key: "passwordBasedAuth", value: (process.env.IAM_PASSWORD_BASED_AUTH?.trim() ?? 'true') === 'true', level: SettingLevel.SystemAdminEditable },
      { key: "passwordlessRegistrationValidateWhat", value: (process.env.IAM_PASSWORD_LESS_REGISTRATION_VALIDATE_WHAT ?? 'email').split(',').map((item) => item.trim()), level: SettingLevel.SystemAdminEditable },
      { key: "allowPublicRegistration", value: (process.env.IAM_ALLOW_PUBLIC_REGISTRATION ?? 'true') === 'true', level: SettingLevel.SystemAdminEditable },
      { key: "activateUserOnRegistration", value: (process.env.IAM_ACTIVATE_USER_ON_REGISTRATION ?? 'true') === 'true', level: SettingLevel.SystemAdminEditable },
      { key: "autoLoginUserOnRegistration", value: (process.env.IAM_AUTO_LOGIN_USER_ON_REGISTRATION ?? 'false') === 'true', level: SettingLevel.SystemEnv },
      { key: "otpExpiry", value: parseInt(process.env.IAM_OTP_EXPIRY ?? '10'), level: SettingLevel.SystemEnv },
      { key: "forgotPasswordVerificationTokenExpiry", value: parseInt(process.env.IAM_FORGOT_PASSWORD_VERIFICATION_TOKEN_EXPIRY ?? '10'), level: SettingLevel.SystemEnv },
      { key: "defaultRole", value: process.env.IAM_DEFAULT_ROLE ?? 'Public', level: SettingLevel.SystemAdminEditable },
      { key: "dummyOtp", value: process.env.IAM_OTP_DUMMY, level: SettingLevel.SystemEnv },
      { key: "forgotPasswordSendVerificationTokenOn", value: process.env.IAM_FORGOT_PASSWORD_SEND_VERIFICATION_TOKEN_ON ?? 'email', level: SettingLevel.SystemEnv },
      { key: "forceChangePasswordOnFirstLogin", value: false, level: SettingLevel.SystemAdminEditable },
      { key: "authenticationPasswordRegex", value: process.env.PASSWORD_REGEX || '^$|^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\da-zA-Z]).*$', level: SettingLevel.SystemAdminEditable },
      { key: "authenticationPasswordRegexErrorMessage", value: process.env.PASSWORD_REGEX_ERROR_MESSAGE || 'Password must contain at least one uppercase, one lowercase, one number, and one special character.', level: SettingLevel.SystemAdminEditable },
      { key: "authenticationPasswordComplexityDescription", value: process.env.PASSWORD_COMPLEXITY_DESC || 'Password must contain at least one uppercase, one lowercase, one number, and one special character.', level: SettingLevel.SystemAdminEditable },
      { key: "iamAutoGeneratedPassword", value: process.env.IAM_AUTOGENERATED_PASSWORD || true, level: SettingLevel.SystemAdminEditable },
      { key: "passwordPepper", value: process.env.IAM_PASSWORD_PEPPER || '', level: SettingLevel.SystemEnv }, // Adding a pepper to the password hashing process for extra security,
      { key: "showNameFieldsForRegistration", value: process.env.IAM_SHOW_NAME_FIELDS_FOR_REGISTRATION === 'true' ? true : false, level: SettingLevel.SystemAdminEditable },
      { key: "sendWelcomeEmailOnSignup", value: (process.env.IAM_SEND_WELCOME_EMAIL_ON_SIGNUP ?? 'false').toLowerCase() === 'true', level: SettingLevel.SystemEnv },
      { key: "sendWelcomeSmsOnSignup", value: (process.env.IAM_SEND_WELCOME_SMS_ON_SIGNUP ?? 'false').toLowerCase() === 'true', level: SettingLevel.SystemEnv },
      { key: "frontendLoginPageUrl", value: process.env.IAM_FRONTEND_APP_LOGIN_PAGE_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "frontendForgotPasswordPageUrl", value: process.env.IAM_FRONTEND_APP_FORGOT_PASSWORD_PAGE_URL, level: SettingLevel.SystemAdminReadonly },

      // jwt-settings-provider.service.ts
      { key: "secret", value: process.env.IAM_JWT_SECRET, level: SettingLevel.SystemEnv },
      { key: "audience", value: process.env.IAM_JWT_TOKEN_AUDIENCE, level: SettingLevel.SystemAdminReadonly },
      { key: "issuer", value: process.env.IAM_JWT_TOKEN_ISSUER, level: SettingLevel.SystemAdminReadonly },
      { key: "accessTokenTtl", value: parseInt(process.env.IAM_JWT_ACCESS_TOKEN_TTL ?? (isProd ? "1200" : "86400"), 10,), level: SettingLevel.SystemEnv },
      { key: "refreshTokenTtl", value: parseInt(process.env.IAM_JWT_REFRESH_TOKEN_TTL ?? "604800", 10), level: SettingLevel.SystemEnv },

      // queues-settings-provider.service.ts
      { key: "queuesDefaultBroker", value: process.env.QUEUES_DEFAULT_BROKER || 'database', level: SettingLevel.SystemAdminReadonly },
      { key: "queuesServiceRole", value: process.env.QUEUES_SERVICE_ROLE, level: SettingLevel.SystemAdminReadonly },
      { key: "queuesRabbitMqUrl", value: process.env.QUEUES_RABBIT_MQ_URL, level: SettingLevel.SystemEnv },
      { key: "solidCliRunning", value: process.env.SOLID_CLI_RUNNING || "false", level: SettingLevel.SystemEnv },
    
      // sms-settings-provider.service.ts
      { key: "smsProvider", value: process.env.COMMON_SMS_PROVIDER, level: SettingLevel.SystemAdminReadonly },
      { key: "smsTemplateSeederFiles", value: process.env.COMMON_SMS_TEMPLATE_SEEDER_FILES, level: SettingLevel.SystemAdminReadonly },
      { key: "shouldQueueSms", value: (process.env.COMMON_SMS_SHOULD_QUEUE ?? 'false') === 'true', level: SettingLevel.SystemAdminReadonly },
      { key: "msg91SmsUrl", value: process.env.COMMON_MSG91_SMS_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "msg91SmsApiKey", value: process.env.COMMON_MSG91_SMS_API_KEY, level: SettingLevel.SystemEnv },
      { key: "twilioAccountSid", value: process.env.COMMON_TWILIO_ACCOUNT_SID, level: SettingLevel.SystemAdminReadonly },
      { key: "twilioAuthToken", value: process.env.COMMON_TWILIO_AUTH_TOKEN, level: SettingLevel.SystemEnv },
      { key: "twilioNumber", value: process.env.COMMON_TWILIO_NUMBER, level: SettingLevel.SystemAdminReadonly },

      // tiny-url-settings-provider.service.ts
      { key: "tinyUrlApiUrl", value: process.env.COMMON_SHORT_URL_API_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "tinyUrlApiKey", value: process.env.COMMON_SHORT_URL_API_KEY, level: SettingLevel.SystemEnv },
      { key: "tinyUrlDomain", value: process.env.COMMON_SHORT_URL_DOMAIN, level: SettingLevel.SystemAdminReadonly },
      { key: "tinyUrlEnabled", value: (process.env.COMMON_SHORT_URL_ENABLED ?? 'false') === 'true', level: SettingLevel.SystemAdminReadonly },

      // whatsapp-settings-provider.service.ts
      { key: "whatsappProvider", value: process.env.COMMON_WHATSAPP_PROVIDER, level: SettingLevel.SystemAdminReadonly },
      { key: "msg91WhatsappUrl", value: process.env.COMMON_WHATSAPP_API_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "msg91WhatsappApiKey", value: process.env.COMMON_WHATSAPP_API_KEY, level: SettingLevel.SystemEnv },
      { key: "msg91WhatsappIntegratedNumber", value: process.env.COMMON_WHATSAPP_INTEGRATED_NUMBER, level: SettingLevel.SystemAdminReadonly },
    
    ];
  }
}
