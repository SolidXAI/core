import { Injectable } from "@nestjs/common";
import { Environment } from "src/decorators/disallow-in-production.decorator";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingDefinition, SettingLevel } from "src/interfaces";

const DEFAULT_MEDIA_UPLOAD_DIR = 'media-uploads';
const DEFAULT_MEDIA_FILE_STORAGE_DIR = 'media-files-storage';

const getSolidCoreSettings = (isProd: boolean) => ([
  { moduleName: "solid-core", key: "iamGoogleOAuthEnabled", value: false, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "authPagesLayout", value: "center", level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "authPagesTheme", value: "light", level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "appLogo", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "companylogo", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "favicon", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "appLogoPosition", value: "in_form_view", level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "showAuthContent", value: false, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "appTitle", value: process.env.SOLID_APP_NAME || "Solid App", level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "appSubtitle", value: process.env.SOLID_APP_SUBTITLE || "", level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "appDescription", value: process.env.SOLID_APP_DESCRIPTION || "", level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "showLegalLinks", value: false, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "appTnc", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "appPrivacyPolicy", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "enableDarkMode", value: true, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "copyright", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "enableUsername", value: true, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "enabledNotification", value: true, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "contactSupportEmail", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "contactSupportDisplayName", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "contactSupportIcon", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "authScreenRightBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "authScreenLeftBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "authScreenCenterBackgroundImage", value: null, level: SettingLevel.SystemAdminEditable },
  {
    moduleName: "solid-core", key: "solidXGenAiCodeBuilderConfig", value: JSON.stringify({
      defaultProvider: "",
      availableProviders: []
    }), level: SettingLevel.SystemAdminEditable
  },
  { moduleName: "solid-core", key: "mcpEnabled", value: process.env.MCP_ENABLED, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "mcpServerUrl", value: process.env.MCP_SERVER_URL, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "mcpApiKey", value: process.env.MCP_API_KEY, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "dateTimeFormat", value: process.env.DATE_TIME_FORMAT || "YYYY-MM-DD HH:mm:ss", level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "dateFormat", value: process.env.DATE_FORMAT || "YYYY-MM-DD", level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "baseUrl", value: process.env.BASE_URL, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "solidAppWebsiteUrl", value: process.env.SOLID_APP_WEBSITE_URL, level: SettingLevel.SystemAdminEditable },

  // app-builder-settings-provider.service.ts, app-builder.config.ts
  { moduleName: "solid-core", key: "moduleMetadataSeederFiles", value: process.env.AB_MODULE_METADATA_SEEDER_FILES ?? '', level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "uploadDir", value: process.env.AB_MEDIA_UPLOAD_DIR ?? DEFAULT_MEDIA_UPLOAD_DIR, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "fileStorageDir", value: process.env.AB_MEDIA_FILE_STORAGE_DIR ?? DEFAULT_MEDIA_FILE_STORAGE_DIR, level: SettingLevel.SystemAdminReadonly },

  // aws-s3-settings-provider.service.ts
  { moduleName: "solid-core", key: "S3_AWS_ACCESS_KEY", value: process.env.S3_AWS_ACCESS_KEY, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "S3_AWS_SECRET_KEY", value: process.env.S3_AWS_SECRET_KEY, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "S3_AWS_REGION_NAME", value: process.env.S3_AWS_REGION_NAME, level: SettingLevel.SystemAdminReadonly },

  // email-settings-provider.service.ts
  { moduleName: "solid-core", key: "emailProvider", value: process.env.COMMON_EMAIL_PROVIDER ?? "SMTPEMailService", level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "emailTemplateSeederFiles", value: process.env.COMMON_EMAIL_TEMPLATE_SEEDER_FILES, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "shouldQueueEmails", value: (process.env.COMMON_EMAIL_SHOULD_QUEUE ?? 'false') === 'true', level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "smtpMailHost", value: process.env.COMMON_SMTP_EMAIL_SMTP_HOST, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "smtpMailPort", value: +(process.env.COMMON_SMTP_EMAIL_SMTP_PORT ?? 587), level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "smtpMailUsername", value: process.env.COMMON_SMTP_EMAIL_USERNAME, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "smtpMailPassword", value: process.env.COMMON_SMTP_EMAIL_PASSWORD, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "smtpMailFrom", value: process.env.COMMON_SMTP_EMAIL_FROM ?? process.env.COMMON_EMAIL_FROM, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "apiMailKey", value: process.env.COMMON_API_EMAIL_KEY, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "apiMailFrom", value: process.env.COMMON_EMAIL_FROM, level: SettingLevel.SystemAdminReadonly },

  // genai-settings-provider.service.ts
  { moduleName: "solid-core", key: "ragServerUrl", value: process.env.GENAI_RAG_SERVER_URL, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "ragServerLogin", value: process.env.GENAI_RAG_SERVER_LOGIN, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "ragServerPassword", value: process.env.GENAI_RAG_SERVER_PASSWORD, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "mcpPythonExecutable", value: process.env.MCP_PYTHON_EXECUTABLE, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "mcpClient", value: process.env.MCP_CLIENT, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "mcpRestartTouchFile", value: process.env.MCP_RESTART_TOUCH_FILE || "tmp/restart.touch", level: SettingLevel.SystemEnv },

  // google-oauth-settings-provider.service.ts
  { moduleName: "solid-core", key: "clientID", value: process.env.IAM_GOOGLE_OAUTH_CLIENT_ID, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "clientSecret", value: process.env.IAM_GOOGLE_OAUTH_CLIENT_SECRET, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "callbackURL", value: process.env.IAM_GOOGLE_OAUTH_CALLBACK_URL, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "redirectURL", value: process.env.IAM_GOOGLE_OAUTH_REDIRECT_URL, level: SettingLevel.SystemAdminReadonly },

  // iam-settings-provider.service.ts
  { moduleName: "solid-core", key: "passwordLessAuth", value: (process.env.IAM_PASSWORD_LESS_AUTH?.trim() ?? 'false') === 'true', level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "passwordBasedAuth", value: (process.env.IAM_PASSWORD_BASED_AUTH?.trim() ?? 'true') === 'true', level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "passwordlessRegistrationValidateWhat", value: (process.env.IAM_PASSWORD_LESS_REGISTRATION_VALIDATE_WHAT ?? 'email').split(',').map((item) => item.trim()), level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "allowPublicRegistration", value: (process.env.IAM_ALLOW_PUBLIC_REGISTRATION ?? 'true') === 'true', level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "activateUserOnRegistration", value: (process.env.IAM_ACTIVATE_USER_ON_REGISTRATION ?? 'true') === 'true', level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "autoLoginUserOnRegistration", value: (process.env.IAM_AUTO_LOGIN_USER_ON_REGISTRATION ?? 'false') === 'true', level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "otpExpiry", value: parseInt(process.env.IAM_OTP_EXPIRY ?? '10'), level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "forgotPasswordVerificationTokenExpiry", value: parseInt(process.env.IAM_FORGOT_PASSWORD_VERIFICATION_TOKEN_EXPIRY ?? '10'), level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "defaultRole", value: process.env.IAM_DEFAULT_ROLE ?? 'Public', level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "dummyOtp", value: process.env.IAM_OTP_DUMMY, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "forgotPasswordSendVerificationTokenOn", value: process.env.IAM_FORGOT_PASSWORD_SEND_VERIFICATION_TOKEN_ON ?? 'email', level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "forceChangePasswordOnFirstLogin", value: false, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "authenticationPasswordRegex", value: process.env.PASSWORD_REGEX || '^$|^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\da-zA-Z]).*$', level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "authenticationPasswordRegexErrorMessage", value: process.env.PASSWORD_REGEX_ERROR_MESSAGE || 'Password must contain at least one uppercase, one lowercase, one number, and one special character.', level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "authenticationPasswordComplexityDescription", value: process.env.PASSWORD_COMPLEXITY_DESC || 'Password must contain at least one uppercase, one lowercase, one number, and one special character.', level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "iamAutoGeneratedPassword", value: process.env.IAM_AUTOGENERATED_PASSWORD || true, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "passwordPepper", value: process.env.IAM_PASSWORD_PEPPER || '', level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "showNameFieldsForRegistration", value: process.env.IAM_SHOW_NAME_FIELDS_FOR_REGISTRATION === 'true' ? true : false, level: SettingLevel.SystemAdminEditable },
  { moduleName: "solid-core", key: "sendWelcomeEmailOnSignup", value: (process.env.IAM_SEND_WELCOME_EMAIL_ON_SIGNUP ?? 'false').toLowerCase() === 'true', level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "sendWelcomeSmsOnSignup", value: (process.env.IAM_SEND_WELCOME_SMS_ON_SIGNUP ?? 'false').toLowerCase() === 'true', level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "frontendLoginPageUrl", value: process.env.IAM_FRONTEND_APP_LOGIN_PAGE_URL, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "frontendForgotPasswordPageUrl", value: process.env.IAM_FRONTEND_APP_FORGOT_PASSWORD_PAGE_URL, level: SettingLevel.SystemAdminReadonly },

  // jwt-settings-provider.service.ts
  { moduleName: "solid-core", key: "secret", value: process.env.IAM_JWT_SECRET, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "audience", value: process.env.IAM_JWT_TOKEN_AUDIENCE, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "issuer", value: process.env.IAM_JWT_TOKEN_ISSUER, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "accessTokenTtl", value: parseInt(process.env.IAM_JWT_ACCESS_TOKEN_TTL ?? (isProd ? "1200" : "86400"), 10,), level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "refreshTokenTtl", value: parseInt(process.env.IAM_JWT_REFRESH_TOKEN_TTL ?? "604800", 10), level: SettingLevel.SystemEnv },

  // queues-settings-provider.service.ts
  { moduleName: "solid-core", key: "queuesDefaultBroker", value: process.env.QUEUES_DEFAULT_BROKER || 'database', level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "queuesServiceRole", value: process.env.QUEUES_SERVICE_ROLE, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "queuesRabbitMqUrl", value: process.env.QUEUES_RABBIT_MQ_URL, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "solidCliRunning", value: process.env.SOLID_CLI_RUNNING || "false", level: SettingLevel.SystemEnv },

  // sms-settings-provider.service.ts
  { moduleName: "solid-core", key: "smsProvider", value: process.env.COMMON_SMS_PROVIDER, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "smsTemplateSeederFiles", value: process.env.COMMON_SMS_TEMPLATE_SEEDER_FILES, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "shouldQueueSms", value: (process.env.COMMON_SMS_SHOULD_QUEUE ?? 'false') === 'true', level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "msg91SmsUrl", value: process.env.COMMON_MSG91_SMS_URL, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "msg91SmsApiKey", value: process.env.COMMON_MSG91_SMS_API_KEY, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "twilioAccountSid", value: process.env.COMMON_TWILIO_ACCOUNT_SID, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "twilioAuthToken", value: process.env.COMMON_TWILIO_AUTH_TOKEN, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "twilioNumber", value: process.env.COMMON_TWILIO_NUMBER, level: SettingLevel.SystemAdminReadonly },

  // tiny-url-settings-provider.service.ts
  { moduleName: "solid-core", key: "tinyUrlApiUrl", value: process.env.COMMON_SHORT_URL_API_URL, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "tinyUrlApiKey", value: process.env.COMMON_SHORT_URL_API_KEY, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "tinyUrlDomain", value: process.env.COMMON_SHORT_URL_DOMAIN, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "tinyUrlEnabled", value: (process.env.COMMON_SHORT_URL_ENABLED ?? 'false') === 'true', level: SettingLevel.SystemAdminReadonly },

  // whatsapp-settings-provider.service.ts
  { moduleName: "solid-core", key: "whatsappProvider", value: process.env.COMMON_WHATSAPP_PROVIDER, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "msg91WhatsappUrl", value: process.env.COMMON_WHATSAPP_API_URL, level: SettingLevel.SystemAdminReadonly },
  { moduleName: "solid-core", key: "msg91WhatsappApiKey", value: process.env.COMMON_WHATSAPP_API_KEY, level: SettingLevel.SystemEnv },
  { moduleName: "solid-core", key: "msg91WhatsappIntegratedNumber", value: process.env.COMMON_WHATSAPP_INTEGRATED_NUMBER, level: SettingLevel.SystemAdminReadonly },
] as const satisfies SettingDefinition[]);

export type SolidCoreSetting = ReturnType<typeof getSolidCoreSettings>[number]["key"];

@SettingsProvider()
@Injectable()
export class SolidCoreDefaultSettingsProvider implements ISettingsProvider {

  getSettings() {
    const isProd = (process.env.ENV as Environment) === Environment.Production;
    return getSolidCoreSettings(isProd);
  }
}
