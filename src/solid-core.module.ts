import "multer";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  DiscoveryService,
  MetadataScanner,
  Reflector,
} from "@nestjs/core";
import { MulterModule } from "@nestjs/platform-express";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RemoveFieldsCommand } from "./commands/remove-fields.command";
import { FieldMetadataController } from "./controllers/field-metadata.controller";
import { DashboardController } from "./controllers/dashboard.controller";
import { MediaStorageProviderMetadataController } from "./controllers/media-storage-provider-metadata.controller";
import { ModelMetadataController } from "./controllers/model-metadata.controller";
import { ModuleMetadataExplorerController } from "./controllers/module-metadata-explorer.controller";
import { ModuleMetadataController } from "./controllers/module-metadata.controller";
import { ModulePackageController } from "./controllers/module-package.controller";
import { DatasourceManagementController } from "./controllers/datasource-management.controller";
import { DatasourceIntrospectionController } from "./controllers/datasource-introspection.controller";
import { TestController } from "./controllers/test.controller";
import { FieldMetadata } from "./entities/field-metadata.entity";
import { ListOfValues } from "./entities/list-of-values.entity";
import { MediaStorageProviderMetadata } from "./entities/media-storage-provider-metadata.entity";
import { Media } from "./entities/media.entity";
import { ModelMetadata } from "./entities/model-metadata.entity";
import { ModuleMetadata } from "./entities/module-metadata.entity";
import { CommandService } from "./helpers/command.service";
import { SchematicService } from "./helpers/schematic.service";
import { ListOfValuesSelectionProvider } from "./services/selection-providers/list-of-values-selection-providers.service";
import { MqDashboardMessageBrokerVariableOptionsProvider } from "./services/selection-providers/mq-dashboard-message-broker-variable-options-provider.service";
import { MqDashboardQueueNameVariableOptionsProvider } from "./services/selection-providers/mq-dashboard-queue-name-variable-options-provider.service";
import { PseudoForeignKeySelectionProvider } from "./services/selection-providers/pseudo-foreign-key-selection-provider.service";
import { ModuleMetadataSeederService } from "./seeders/module-metadata-seeder.service";
import { ModuleTestDataService } from "./seeders/module-test-data.service";
import { DraftPublishHelperService } from "./services/draft-publish-helper.service";
import { InternationalisationHelperService } from "./services/internationalisation-helper.service";
import { CrudHelperService } from "./services/crud-helper.service";
import { DatasourceManagementService } from "./services/datasource-management.service";
import { DatasourceIntrospectionService } from "./services/datasource-introspection.service";
import { FieldMetadataService } from "./services/field-metadata.service";
import { DashboardRuntimeService } from "./services/dashboard-runtime.service";
import { ListOfValuesService } from "./services/list-of-values.service";
// import { MediaStorageProviderMetadataSeederService } from './services/media-storage-provider-metadata-seeder.service';
import { MediaStorageProviderMetadataService } from "./services/media-storage-provider-metadata.service";
import { MediaService } from "./services/media.service";
import { MediaDownloadUrlService } from "./services/media-download-url.service";
import { ModelMetadataService } from "./services/model-metadata.service";
import { ModuleMetadataExplorerService } from "./services/module-metadata-explorer.service";
import { ModuleMetadataService } from "./services/module-metadata.service";
import { ModulePackageService } from "./services/module-package.service";
import { SolidIntrospectService } from "./services/solid-introspect.service";
// import { ListOfComputedFieldProvider } from './providers/list-of-computed-field-provider.service';
import { ServeStaticModule } from "@nestjs/serve-static";
import { basename, join } from "path";
import { RefreshModelCommand } from "./commands/refresh-model.command";
import { MediaController } from "./controllers/media.controller";
import { getLowercaseFileExtension, INLINE_SAFE_EXTENSIONS } from "./constants/media-file-types";

import { RefreshModuleCommand } from "./commands/refresh-module.command";
import { ModelMetadataSubscriber } from "./subscribers/model-metadata.subscriber";

import { ViewMetadataController } from "./controllers/view-metadata.controller";
import { ViewMetadata } from "./entities/view-metadata.entity";
import { ViewMetadataService } from "./services/view-metadata.service";

import { ActionMetadataController } from "./controllers/action-metadata.controller";
import { ActionMetadata } from "./entities/action-metadata.entity";
import { ActionMetadataService } from "./services/action-metadata.service";

import { FacebookAuthenticationController } from "./controllers/facebook-authentication.controller";
import { MicrosoftAuthenticationController } from "./controllers/microsoft-authentication.controller";
import { MicrosoftActiveDirectoryAuthenticationController } from "./controllers/microsoft-active-directory-authentication.controller";
import { FacebookOAuthStrategy } from "./passport-strategies/facebook-oauth.strategy";
import { MicrosoftOAuthStrategy } from "./passport-strategies/microsoft-oauth.strategy";
import { MicrosoftActiveDirectoryOAuthStrategy } from "./passport-strategies/microsoft-active-directory-oauth.strategy";

import { GupshupOtpWhatsappService } from "./services/whatsapp/GupshupOtpWhatsappService";
import { MetaCloudWhatsappService } from "./services/whatsapp/MetaCloudWhatsappService";
import { GupshupWebhookController } from "./controllers/gupshup-webhook.controller";
import { MetaCloudWhatsappWebhookController } from "./controllers/meta-cloud-whatsapp-webhook.controller";

import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { SeedCommand } from "./commands/seed.command";
import { TestDataCommand } from "./commands/test-data.command";
import { TestRunCommand } from "./commands/run-tests.command";
import { TestCommand } from "./commands/test.command";
import { AuthenticationController } from "./controllers/authentication.controller";
import { EmailTemplateController } from "./controllers/email-template.controller";
import { GoogleAuthenticationController } from "./controllers/google-authentication.controller";
import { MenuItemMetadataController } from "./controllers/menu-item-metadata.controller";
import { MqMessageQueueController } from "./controllers/mq-message-queue.controller";
import { MqMessageController } from "./controllers/mq-message.controller";
import { MpinAuthenticationController } from "./controllers/mpin-authentication.controller";
import { OTPAuthenticationController } from "./controllers/otp-authentication.controller";
import { ServiceController } from "./controllers/service.controller";
import { SmsTemplateController } from "./controllers/sms-template.controller";
import { TestQueueController } from "./controllers/test-queue.controller";
import { TestRunController } from "./controllers/test-run.controller";
import { EmailAttachment } from "./entities/email-attachment.entity";
import { EmailTemplate } from "./entities/email-template.entity";
import { MenuItemMetadata } from "./entities/menu-item-metadata.entity";
import { MqMessageQueue } from "./entities/mq-message-queue.entity";
import { MqMessage } from "./entities/mq-message.entity";
import { SmsTemplate } from "./entities/sms-template.entity";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { MediaSignedUrlGuard } from "./guards/media-signed-url.guard";
import { AuthenticationGuard } from "./guards/authentication.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { SolidRegistry } from "./helpers/solid-registry";
import { LoggingInterceptor } from "./interceptors/logging.interceptor";
import { ApiEmailQueuePublisher } from "./jobs/rabbitmq/api-email-publisher.service";
import { ApiEmailQueueSubscriber } from "./jobs/rabbitmq/api-email-subscriber.service";
import { TestQueuePublisherDatabase } from "./jobs/database/test-queue-publisher-database.service";
import { TestQueueSubscriberDatabase } from "./jobs/database/test-queue-subscriber-database.service";
import { TestRunQueuePublisherDatabase } from "./jobs/database/test-run-queue-publisher-database.service";
import { TestRunQueueSubscriberDatabase } from "./jobs/database/test-run-queue-subscriber-database.service";
import { TestQueuePublisherRedis } from "./jobs/redis/test-queue-publisher-redis.service";
import { TestQueueSubscriberRedis } from "./jobs/redis/test-queue-subscriber-redis.service";
import { Msg91WhatsappQueuePublisher } from "./jobs/rabbitmq/msg91-whatsapp-publisher.service";
import { Msg91WhatsappQueueSubscriber } from "./jobs/rabbitmq/msg91-whatsapp-subscriber.service";
import { Msg91OTPQueuePublisher } from "./jobs/rabbitmq/msg91-otp-publisher.service";
import { Msg91OTPQueueSubscriber } from "./jobs/rabbitmq/msg91-otp-subscriber.service";
import { Msg91SmsQueuePublisher } from "./jobs/rabbitmq/msg91-sms-publisher.service";
import { Msg91SmsQueueSubscriber } from "./jobs/rabbitmq/msg91-sms-subscriber.service";
import { SmtpEmailQueuePublisherRabbitmq } from "./jobs/rabbitmq/smtp-email-publisher.service";
import { SmtpEmailQueueSubscriberRabbitmq } from "./jobs/rabbitmq/smtp-email-subscriber.service";
import { TestQueuePublisher } from "./jobs/rabbitmq/test-queue-publisher.service";
import { TestQueueSubscriber } from "./jobs/rabbitmq/test-queue-subscriber.service";
import { ChatterQueuePublisherRabbitmq } from "./jobs/rabbitmq/chatter-queue-publisher.service";
import { ChatterQueueSubscriberRabbitmq } from "./jobs/rabbitmq/chatter-queue-subscriber.service";
import { ChatterQueuePublisherDatabase } from "./jobs/database/chatter-queue-publisher-database.service";
import { ChatterQueueSubscriberDatabase } from "./jobs/database/chatter-queue-subscriber-database.service";
import { ChatterMentionNotificationEmailQueueHandler } from "./jobs/chatter-mention-notification-email-queue-handler.service";
import { ChatterMentionNotificationEmailQueuePublisherDatabase } from "./jobs/database/chatter-mention-notification-email-publisher-database.service";
import { ChatterMentionNotificationEmailQueueSubscriberDatabase } from "./jobs/database/chatter-mention-notification-email-subscriber-database.service";
import { ChatterMentionNotificationEmailQueuePublisherRabbitmq } from "./jobs/rabbitmq/chatter-mention-notification-email-publisher.service";
import { ChatterMentionNotificationEmailQueueSubscriberRabbitmq } from "./jobs/rabbitmq/chatter-mention-notification-email-subscriber.service";
import { ApiEmailQueuePublisherRedis } from "./jobs/redis/api-email-publisher-redis.service";
import { ApiEmailQueueSubscriberRedis } from "./jobs/redis/api-email-subscriber-redis.service";
import { ChatterQueuePublisherRedis } from "./jobs/redis/chatter-queue-publisher-redis.service";
import { ChatterQueueSubscriberRedis } from "./jobs/redis/chatter-queue-subscriber-redis.service";
import { ChatterMentionNotificationEmailQueuePublisherRedis } from "./jobs/redis/chatter-mention-notification-email-publisher-redis.service";
import { ChatterMentionNotificationEmailQueueSubscriberRedis } from "./jobs/redis/chatter-mention-notification-email-subscriber-redis.service";
import { ComputedFieldEvaluationPublisherRedis } from "./jobs/redis/computed-field-evaluation-publisher-redis.service";
import { ComputedFieldEvaluationSubscriberRedis } from "./jobs/redis/computed-field-evaluation-subscriber-redis.service";
import { GenerateCodePublisherRedis } from "./jobs/redis/generate-code-publisher-redis.service";
import { GenerateCodeSubscriberRedis } from "./jobs/redis/generate-code-subscriber-redis.service";
import { WorkflowExecutionPublisherRedis } from "./jobs/redis/workflow-execution-publisher-redis.service";
import { WorkflowExecutionSubscriberRedis } from "./jobs/redis/workflow-execution-subscriber-redis.service";
import { Msg91OTPQueuePublisherRedis } from "./jobs/redis/msg91-otp-publisher-redis.service";
import { Msg91OTPQueueSubscriberRedis } from "./jobs/redis/msg91-otp-subscriber-redis.service";
import { Msg91SmsQueuePublisherRedis } from "./jobs/redis/msg91-sms-publisher-redis.service";
import { Msg91SmsQueueSubscriberRedis } from "./jobs/redis/msg91-sms-subscriber-redis.service";
import { Msg91WhatsappQueuePublisherRedis } from "./jobs/redis/msg91-whatsapp-publisher-redis.service";
import { Msg91WhatsappQueueSubscriberRedis } from "./jobs/redis/msg91-whatsapp-subscriber-redis.service";
import { SmtpEmailQueuePublisherRedis } from "./jobs/redis/smtp-email-publisher-redis.service";
import { SmtpEmailQueueSubscriberRedis } from "./jobs/redis/smtp-email-subscriber-redis.service";
import { Three60WhatsappQueuePublisherRedis } from "./jobs/redis/three60-whatsapp-publisher-redis.service";
import { Three60WhatsappQueueSubscriberRedis } from "./jobs/redis/three60-whatsapp-subscriber-redis.service";
import { TwilioSmsQueuePublisherRedis } from "./jobs/redis/twilio-sms-publisher-redis.service";
import { TwilioSmsQueueSubscriberRedis } from "./jobs/redis/twilio-sms-subscriber-redis.service";
import { UserRegistrationListener } from "./listeners/user-registration.listener";
import { GoogleOauthStrategy } from "./passport-strategies/google-oauth.strategy";
import { ApiKeyService } from "./services/api-key.service";
import { MpinService } from "./services/mpin.service";
import { ActiveSessionStorageService } from "./services/active-session-storage.service";
import { AccessTokenDenylistService } from "./services/access-token-denylist.service";
import { AuthenticationService } from "./services/authentication.service";
import { MetadataValidationService } from "./services/metadata-validation.service";
import { BcryptService } from "./services/bcrypt.service";
import { UuidExternalIdEntityComputedFieldProvider } from "./services/computed-fields/entity/uuid-externalid-entity-computed-field-provider.service";
import { UuidExternalIdComputedFieldProvider } from "./services/computed-fields/uuid-external-id-computed-field-provider.service";
import { EmailTemplateService } from "./services/email-template.service";
import {
  DiskFileService,
  S3FileService,
  FileServiceFactory,
  DiskStoragePathBuilder,
  S3StoragePathBuilder,
  StoragePathBuilderFactory,
} from "./services/file";
import { HashingService } from "./services/hashing.service";
import { ElasticEmailService } from "./services/mail/elastic-email.service";
import { SMTPEMailService } from "./services/mail/smtp-email.service";
import { MenuItemMetadataService } from "./services/menu-item-metadata.service";
import { MqMessageQueueService } from "./services/mq-message-queue.service";
import { MqMessageService } from "./services/mq-message.service";
import { PdfService } from "./services/pdf.service";
import { RefreshTokenIdsStorageService } from "./services/refresh-token-ids-storage.service";
import { SsoCodeStorageService } from "./services/sso-code-storage.service";
import { ListOfModelsSelectionProvider } from "./services/selection-providers/list-of-models-selection-provider.service";
import { TinyUrlService } from "./services/short-url/tiny-url.service";
import { SmsTemplateService } from "./services/sms-template.service";
import { Msg91OTPService } from "./services/sms/Msg91OTPService";
import { Msg91SMSService } from "./services/sms/Msg91SMSService";
// import { UserService } from './services/user.service';
import { Msg91WhatsappService } from "./services/whatsapp/Msg91WhatsappService";
import { SoftDeleteAwareEventSubscriber } from "./subscribers/soft-delete-aware-event.subscriber";

import { PermissionMetadataController } from "./controllers/permission-metadata.controller";
import { PermissionMetadata } from "./entities/permission-metadata.entity";
import { PermissionMetadataService } from "./services/permission-metadata.service";

import { ScheduleModule } from "@nestjs/schedule";
import { ClsModule } from "nestjs-cls";
import { ChatterMessageDetailsController } from "./controllers/chatter-message-details.controller";
import { ChatterMessageController } from "./controllers/chatter-message.controller";

import { ExportTemplateController } from './controllers/export-template.controller';
import { ExportTransactionController } from './controllers/export-transaction.controller';
import { ImportTransactionErrorLogController } from './controllers/import-transaction-error-log.controller';
import { ImportTransactionController } from './controllers/import-transaction.controller';
import { ListOfValuesController } from './controllers/list-of-values.controller';
import { LocaleController } from './controllers/locale.controller';
import { RoleMetadataController } from './controllers/role-metadata.controller';
import { SavedFiltersController } from './controllers/saved-filters.controller';
import { ScheduledJobController } from './controllers/scheduled-job.controller';
import { AgentSessionController } from './controllers/agent-session.controller';
import { AgentEventController } from './controllers/agent-event.controller';
import { McpAuditLogController } from './controllers/mcp-audit-log.controller';
import { SecurityRuleController } from './controllers/security-rule.controller';
import { SettingController } from './controllers/setting.controller';
import { InfoController } from './controllers/info.controller';
import { InfoService } from './services/info.service';
import { UserActivityHistoryController } from './controllers/user-activity-history.controller';
import { UserViewMetadataController } from './controllers/user-view-metadata.controller';
import { UserController } from './controllers/user.controller';
import { ChatterMessageDetails } from './entities/chatter-message-details.entity';
import { ChatterMessage } from './entities/chatter-message.entity';

import { ExportTemplate } from './entities/export-template.entity';
import { ExportTransaction } from './entities/export-transaction.entity';
import { ImportTransactionErrorLog } from './entities/import-transaction-error-log.entity';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Locale } from './entities/locale.entity';
import { RoleMetadata } from './entities/role-metadata.entity';
import { SavedFilters } from './entities/saved-filters.entity';
import { ScheduledJob } from './entities/scheduled-job.entity';
import { AgentSession } from './entities/agent-session.entity';
import { AgentEvent } from './entities/agent-event.entity';
import { McpAuditLog } from './entities/mcp-audit-log.entity';
import { SecurityRule } from './entities/security-rule.entity';
import { Setting } from './entities/setting.entity';
import { UserActivityHistory } from './entities/user-activity-history.entity';
import { UserViewMetadata } from './entities/user-view-metadata.entity';
import { UserApiKey } from './entities/user-api-key.entity';
import { UserDeviceCredential } from './entities/user-device-credential.entity';
import { User } from './entities/user.entity';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ModelMetadataHelperService } from './helpers/model-metadata-helper.service';
import { ModuleMetadataHelperService } from './helpers/module-metadata-helper.service';
import { ApiEmailQueuePublisherDatabase } from './jobs/database/api-email-publisher-database.service';
import { ApiEmailQueueSubscriberDatabase } from './jobs/database/api-email-subscriber-database.service';
import { ComputedFieldEvaluationPublisherDatabase } from './jobs/database/computed-field-evaluation-publisher-database.service';
import { ComputedFieldEvaluationSubscriberDatabase } from './jobs/database/computed-field-evaluation-subscriber-database.service';
import { GenerateCodePublisherDatabase } from './jobs/database/generate-code-publisher-database.service';
import { GenerateCodeSubscriberDatabase } from './jobs/database/generate-code-subscriber-database.service';
import { WorkflowExecutionPublisherDatabase } from './jobs/database/workflow-execution-publisher-database.service';
import { WorkflowExecutionSubscriberDatabase } from './jobs/database/workflow-execution-subscriber-database.service';
import { OTPQueuePublisherDatabase } from './jobs/database/otp-publisher-database.service';
import { OTPQueueSubscriberDatabase } from './jobs/database/otp-subscriber-database.service';
import { Msg91SmsQueuePublisherDatabase } from './jobs/database/msg91-sms-publisher-database.service';
import { Msg91SmsQueueSubscriberDatabase } from './jobs/database/msg91-sms-subscriber-database.service';
import { SmtpEmailQueuePublisherDatabase } from './jobs/database/smtp-email-publisher-database.service';
import { SmtpEmailQueueSubscriberDatabase } from './jobs/database/smtp-email-subscriber-database.service';

import { TwilioSmsQueuePublisherDatabase } from "./jobs/database/twilio-sms-publisher-database.service";
import { TwilioSmsQueueSubscriberDatabase } from "./jobs/database/twilio-sms-subscriber-database.service";

// import { ThrottlerModule } from '@nestjs/throttler';
import { MailFactory } from "./factories/mail.factory";
import { ErrorMapperService } from "./helpers/error-mapper.service";
import { SolidCoreErrorCodesProvider } from "./helpers/solid-core-error-codes-provider.service";
import { ComputedFieldEvaluationPublisherRabbitmq } from "./jobs/rabbitmq/computed-field-evaluation-publisher.service";
import { ComputedFieldEvaluationSubscriberRabbitmq } from "./jobs/rabbitmq/computed-field-evaluation-subscriber.service";
import { Msg91WhatsappQueuePublisherDatabase } from "./jobs/database/msg91-whatsapp-publisher-database.service";
import { Msg91WhatsappQueueSubscriberDatabase } from "./jobs/database/msg91-whatsapp-subscriber-database.service";
import { Three60WhatsappQueuePublisherDatabase } from "./jobs/database/three60-whatsapp-publisher-database.service";
import { Three60WhatsappQueueSubscriberDatabase } from "./jobs/database/three60-whatsapp-subscriber-database.service";
import { GenerateCodePublisherRabbitmq } from "./jobs/rabbitmq/generate-code-publisher.service";
import { GenerateCodeSubscriberRabbitmq } from "./jobs/rabbitmq/generate-code-subscriber.service";
import { WorkflowExecutionPublisherRabbitmq } from "./jobs/rabbitmq/workflow-execution-publisher.service";
import { WorkflowExecutionSubscriberRabbitmq } from "./jobs/rabbitmq/workflow-execution-subscriber.service";
import { Three60WhatsappQueuePublisher } from "./jobs/rabbitmq/three60-whatsapp-publisher.service";
import { Three60WhatsappQueueSubscriber } from "./jobs/rabbitmq/three60-whatsapp-subscriber.service";
import { TwilioSmsQueuePublisherRabbitmq } from "./jobs/rabbitmq/twilio-sms-publisher.service";
import { TwilioSmsQueueSubscriberRabbitmq } from "./jobs/rabbitmq/twilio-sms-subscriber.service";
import { ListOfValuesMapper } from "./mappers/list-of-values-mapper";
import { ActionMetadataRepository } from "./repository/action-metadata.repository";
import { ChatterMessageDetailsRepository } from "./repository/chatter-message-details.repository";
import { ChatterMessageRepository } from "./repository/chatter-message.repository";

import { EmailTemplateRepository } from './repository/email-template.repository';
import { ExportTemplateRepository } from './repository/export-template.repository';
import { ExportTransactionRepository } from './repository/export-transaction.repository';
import { FieldMetadataRepository } from './repository/field-metadata.repository';
import { ImportTransactionErrorLogRepository } from './repository/import-transaction-error-log.repository';
import { ImportTransactionRepository } from './repository/import-transaction.repository';
import { ListOfValuesRepository } from './repository/list-of-values.repository';
import { LocaleRepository } from './repository/locale.repository';
import { MediaRepository } from './repository/media.repository';
import { MenuItemMetadataRepository } from './repository/menu-item-metadata.repository';
import { ModelMetadataRepository } from './repository/model-metadata.repository';
import { ModuleMetadataRepository } from './repository/module-metadata.repository';
import { MqMessageQueueRepository } from './repository/mq-message-queue.repository';
import { MqMessageRepository } from './repository/mq-message.repository';
import { PermissionMetadataRepository } from './repository/permission-metadata.repository';
import { RoleMetadataRepository } from './repository/role-metadata.repository';
import { SavedFiltersRepository } from './repository/saved-filters.repository';
import { ScheduledJobRepository } from './repository/scheduled-job.repository';
import { AgentSessionRepository } from './repository/agent-session.repository';
import { AgentEventRepository } from './repository/agent-event.repository';
import { McpAuditLogRepository } from './repository/mcp-audit-log.repository';
import { SecurityRuleRepository } from './repository/security-rule.repository';
import { SettingRepository } from './repository/setting.repository';
import { SmsTemplateRepository } from './repository/sms-template.repository';
import { UserActivityHistoryRepository } from './repository/user-activity-history.repository';
import { UserViewMetadataRepository } from './repository/user-view-metadata.repository';
import { UserApiKeyRepository } from './repository/user-api-key.repository';
import { UserDeviceCredentialRepository } from './repository/user-device-credential.repository';
import { UserRepository } from './repository/user.repository';
import { ViewMetadataRepository } from './repository/view-metadata.repository';
import { PermissionMetadataSeederService } from './seeders/permission-metadata-seeder.service';
import { SystemFieldsSeederService } from './seeders/system-fields-seeder.service';
import { ChatterMessageDetailsService } from './services/chatter-message-details.service';
import { ChatterMessageService } from './services/chatter-message.service';
import { ConcatComputedFieldProvider } from './services/computed-fields/concat-computed-field-provider.service';
import { AlphaNumExternalIdComputationProvider } from './services/computed-fields/entity/alpha-num-external-id-computed-field-provider';
import { ConcatEntityComputedFieldProvider } from './services/computed-fields/entity/concat-entity-computed-field-provider.service';
import { MqDashboardFailedMessagesKpiProvider } from './services/dashboard-providers/mq-dashboard-failed-messages-kpi-provider.service';
import { MqDashboardInflightMessagesKpiProvider } from './services/dashboard-providers/mq-dashboard-inflight-messages-kpi-provider.service';
import { MqDashboardLatencyTrendProvider } from './services/dashboard-providers/mq-dashboard-latency-trend-provider.service';
import { MqDashboardMessagesOverTimeProvider } from './services/dashboard-providers/mq-dashboard-messages-over-time-provider.service';
import { MqDashboardQueueWiseAvgElapsedProvider } from './services/dashboard-providers/mq-dashboard-queue-wise-avg-elapsed-provider.service';
import { MqDashboardQueueWiseFailuresProvider } from './services/dashboard-providers/mq-dashboard-queue-wise-failures-provider.service';
import { MqDashboardQueueSlaHeatmapProvider } from './services/dashboard-providers/mq-dashboard-queue-sla-heatmap-provider.service';
import { MqDashboardRecentFailuresProvider } from './services/dashboard-providers/mq-dashboard-recent-failures-provider.service';
import { MqDashboardStageDistributionProvider } from './services/dashboard-providers/mq-dashboard-stage-distribution-provider.service';
import { MqDashboardSucceededMessagesKpiProvider } from './services/dashboard-providers/mq-dashboard-succeeded-messages-kpi-provider.service';
import { MqDashboardSuccessRateKpiProvider } from './services/dashboard-providers/mq-dashboard-success-rate-kpi-provider.service';
import { MqDashboardTotalMessagesKpiProvider } from './services/dashboard-providers/mq-dashboard-total-messages-kpi-provider.service';
import { MqDashboardAvgElapsedKpiProvider } from './services/dashboard-providers/mq-dashboard-avg-elapsed-kpi-provider.service';
import { NoopsEntityComputedFieldProviderService } from './services/computed-fields/entity/noops-entity-computed-field-provider.service';
import { CRUDService } from './services/crud.service';
import { CsvService } from './services/csv.service';

import { ExcelService } from './services/excel.service';
import { ExportTemplateService } from './services/export-template.service';
import { ExportTransactionService } from './services/export-transaction.service';
import { ImportTransactionErrorLogService } from './services/import-transaction-error-log.service';
import { ImportTransactionService } from './services/import-transaction.service';
import { LocaleService } from './services/locale.service';
import { FileS3StorageProvider } from './services/mediaStorageProviders/file-s3-storage-provider';
import { FileStorageProvider } from './services/mediaStorageProviders/file-storage-provider';
import { PollerService } from './services/poller.service';
import { PublisherFactory } from './services/queues/publisher-factory.service';
import { RequestContextService } from './services/request-context.service';
import { RoleMetadataService } from './services/role-metadata.service';
import { SavedFiltersService } from './services/saved-filters.service';
import { ScheduledJobService } from './services/scheduled-job.service';
import { AgentSessionService } from './services/agent-session.service';
import { AgentEventService } from './services/agent-event.service';
import { McpAuditLogService } from './services/mcp-audit-log.service';
import { SchedulerServiceImpl } from './services/scheduled-jobs/scheduler.service';
import { SecurityRuleService } from './services/security-rule.service';
import { ListOfScheduledJobsSelectionProvider } from './services/selection-providers/list-of-scheduled-jobs-selection-provider.service';
import { LocaleListSelectionProvider } from './services/selection-providers/locale-list-selection-provider.service';
import { SettingService } from './services/setting.service';
import { TwilioSMSService } from './services/sms/TwilioSMSService';
import { SolidTsMorphService } from './services/solid-ts-morph.service';
import { TextractService } from './services/textract.service';
import { UserActivityHistoryService } from './services/user-activity-history.service';
import { UserViewMetadataService } from './services/user-view-metadata.service';
import { UserService } from './services/user.service';
import { Three60WhatsappService } from './services/whatsapp/Three60WhatsappService';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import { ComputedEntityFieldSubscriber } from './subscribers/computed-entity-field.subscriber';
import { CreatedByUpdatedBySubscriber } from './subscribers/created-by-updated-by.subscriber';
import { ListOfValuesSubscriber } from './subscribers/list-of-values.subscriber';
import { ScheduledJobSubscriber } from './subscribers/scheduled-job.subscriber';
import { SecurityRuleSubscriber } from './subscribers/security-rule.subscriber';
import { ViewMetadataSubsciber } from './subscribers/view-metadata.subscriber';
import { MediaStorageProviderMetadataRepository } from './repository/media-storage-provider-metadata.repository';
import { McpCommand } from './commands/mcp.command';
import { FixturesService } from './services/fixtures.service';
import { FixturesSetupCommand } from './commands/fixtures/fixtures-setup.command';
import { FixturesTearDownCommand } from './commands/fixtures/fixtures-tear-down.command';
import { SequenceNumComputedFieldProvider } from './services/computed-fields/entity/sequence-num-computed-field-provider';
import { ModelSequence } from './entities/model-sequence.entity';
import { ModelSequenceService } from './services/model-sequence.service';
import { ModelSequenceController } from './controllers/model-sequence.controller';
import { ModelSequenceRepository } from './repository/model-sequence.repository';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheManagerOptions } from './config/cache.options';
import { SolidCoreDefaultSettingsProvider } from './services/settings/default-settings-provider.service';
import { SmsFactory } from './factories/sms.factory';
import { WhatsAppFactory } from './factories/whatsapp.factory';
import { ImageEncodingService } from './helpers/image-encoding.helper';
import { SolidMicroserviceAdapter } from './helpers/solid-microservice-adapter.service';
import { InfoCommand } from './commands/info.command';
import { ListOfRolesSelectionProvider } from './services/selection-providers/list-of-roles-selectionproviders.service';
import { Entity } from 'typeorm';
import { DashboardUserLayout } from './entities/dashboard-user-layout.entity';
import { DashboardUserLayoutService } from './services/dashboard-user-layout.service';
import { DashboardUserLayoutController } from './controllers/dashboard-user-layout.controller';
import { DashboardUserLayoutRepository } from './repositories/dashboard-user-layout.repository';
import { MssqlDatasourceIntrospectionProviderService } from "./services/datasource-introspection/mssql-datasource-introspection-provider.service";
import { MysqlDatasourceIntrospectionProviderService } from "./services/datasource-introspection/mysql-datasource-introspection-provider.service";
import { PostgresDatasourceIntrospectionProviderService } from "./services/datasource-introspection/postgres-datasource-introspection-provider.service";
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { WorkflowExecution } from './entities/workflow-execution.entity';
import { WorkflowStepExecution } from './entities/workflow-step-execution.entity';
import { WorkflowExecutionLog } from './entities/workflow-execution-log.entity';
import { WorkflowExecutionArtifact } from './entities/workflow-execution-artifact.entity';
import { WorkflowTriggerExecution } from './entities/workflow-trigger-execution.entity';
import { WorkflowSecret } from './entities/workflow-secret.entity';
import { WorkflowDefinitionController } from './controllers/workflow-definition.controller';
import { WorkflowExecutionController } from './controllers/workflow-execution.controller';
import { WorkflowStepExecutionController } from './controllers/workflow-step-execution.controller';
import { WorkflowExecutionLogController } from './controllers/workflow-execution-log.controller';
import { WorkflowExecutionArtifactController } from './controllers/workflow-execution-artifact.controller';
import { WorkflowTriggerExecutionController } from './controllers/workflow-trigger-execution.controller';
import { WorkflowSecretController } from './controllers/workflow-secret.controller';
import { WorkflowDefinitionService } from './services/workflow-definition.service';
import { WorkflowDefinitionMetadataSyncService } from './services/workflow/workflow-definition-metadata-sync.service';
import { WorkflowExecutionService } from './services/workflow-execution.service';
import { WorkflowStepExecutionService } from './services/workflow-step-execution.service';
import { WorkflowExecutionLogService } from './services/workflow-execution-log.service';
import { WorkflowExecutionArtifactService } from './services/workflow-execution-artifact.service';
import { WorkflowTriggerExecutionService } from './services/workflow-trigger-execution.service';
import { WorkflowSecretService } from './services/workflow-secret.service';
import { WorkflowDefinitionRepository } from './repository/workflow-definition.repository';
import { WorkflowExecutionRepository } from './repository/workflow-execution.repository';
import { WorkflowStepExecutionRepository } from './repository/workflow-step-execution.repository';
import { WorkflowExecutionLogRepository } from './repository/workflow-execution-log.repository';
import { WorkflowExecutionArtifactRepository } from './repository/workflow-execution-artifact.repository';
import { WorkflowTriggerExecutionRepository } from './repository/workflow-trigger-execution.repository';
import { WorkflowSecretRepository } from './repository/workflow-secret.repository';
import { WorkflowDefinitionValidatorService } from './services/workflow/workflow-definition-validator.service';
import { WorkflowExecutionWriterService } from './services/workflow/workflow-execution-writer.service';
import { WorkflowExpressionService } from './services/workflow/workflow-expression.service';
import { WorkflowInvocationService } from './services/workflow/workflow-invocation.service';
import { WorkflowNodeRegistryService } from './services/workflow/workflow-node-registry.service';
import { WorkflowRuntimeService } from './services/workflow/workflow-runtime.service';
import { WorkflowScheduledTriggerJobService } from './services/workflow/workflow-scheduled-trigger.job';
import { ExecutionFailNode } from './services/workflow/nodes/execution-fail.node';
import { ForEachNode } from './services/workflow/nodes/for-each.node';
import { HttpRequestNode } from './services/workflow/nodes/http-request.node';
import { IfNode } from './services/workflow/nodes/if.node';
import { LogWriteNode } from './services/workflow/nodes/log-write.node';
import { LoopUntilNode } from './services/workflow/nodes/loop-until.node';
import { ParallelNode } from './services/workflow/nodes/parallel.node';
import { RuntimePythonNode } from './services/workflow/nodes/runtime-python.node';
import { SequentialNode } from './services/workflow/nodes/sequential.node';
import {
  SolidXCreateNode,
  SolidXDeleteNode,
  SolidXGetNode,
  SolidXListNode,
  SolidXPatchNode,
  SolidXUpdateNode,
} from './services/workflow/nodes/solidx-crud.nodes';
import { SolidXLoginNode } from './services/workflow/nodes/solidx-login.node';
import { SolidXSendEmailNode } from './services/workflow/nodes/solidx-send-email.node';
import { SolidXSendSmsNode } from './services/workflow/nodes/solidx-send-sms.node';
import { SwitchNode } from './services/workflow/nodes/switch.node';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActionMetadata,
      ChatterMessage,
      ChatterMessageDetails,
      EmailAttachment,
      EmailTemplate,
      ExportTemplate,
      ExportTransaction,
      FieldMetadata,
      ImportTransaction,
      ImportTransactionErrorLog,
      ListOfValues,
      Locale,
      Media,
      MediaStorageProviderMetadata,
      MenuItemMetadata,
      ModelMetadata,
      ModuleMetadata,
      MqMessage,
      MqMessageQueue,
      PermissionMetadata,
      RoleMetadata,
      SavedFilters,
      ScheduledJob,
      AgentSession,
      AgentEvent,
      McpAuditLog,
      SecurityRule,
      Setting,
      SmsTemplate,
      User,
      UserApiKey,
      UserDeviceCredential,
      UserActivityHistory,
      UserViewMetadata,
      ViewMetadata,
      ModelSequence,
      WorkflowDefinition,
      WorkflowExecution,
      WorkflowStepExecution,
      WorkflowExecutionLog,
      WorkflowExecutionArtifact,
      WorkflowTriggerExecution,
      WorkflowSecret,
    ]),

    CacheModule.registerAsync(CacheManagerOptions),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "media-files-storage"),
      serveRoot: "/media-files-storage",
      serveStaticOptions: {
        setHeaders: (res, path) => {
          // Allow use of these files from a different origin (e.g., :3000 UI)
          // Use 'same-site' if both origins are on the same site (localhost:* counts as same-site)
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); // or 'same-site'

          // If you need to load into <canvas> without tainting or fetch images via XHR,
          // you can also expose CORS here (not needed for simple <img>):
          // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

          // Prevent the browser from ever content-sniffing a served file into something
          // more dangerous than its declared Content-Type (e.g. rendering a mislabeled
          // upload as HTML and executing embedded script).
          res.setHeader("X-Content-Type-Options", "nosniff");

          // Only a small allowlist of media types is ever safe to render inline. Everything
          // else (including svg, html, and any other uploaded file) is forced to download
          // rather than be displayed/executed by the browser, regardless of what mimetype or
          // extension it was uploaded with.
          // basename first: getLowercaseFileExtension takes a file name, not a path, so a
          // directory containing a dot must not be mistaken for the extension. An
          // extensionless file yields undefined, which is not inline-safe - so it correctly
          // falls through to the forced-download branch.
          if (!INLINE_SAFE_EXTENSIONS.has(getLowercaseFileExtension(basename(path)) ?? '')) {
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition", "attachment");
          }
        },
      },
    }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        dest: process.env.AB_MEDIA_UPLOAD_DIR ?? "media-uploads",
        // A global floor under whatever per-field mediaMaxSizeKb restrictions apply, not a
        // replacement for them - some upload paths (e.g. chatter attachments) had no size cap
        // enforced anywhere before this. Must stay >= the largest legitimate per-field limit
        // already configured (chatter's messageAttachments is 102400 KB / 100MB), since Multer
        // enforces this before any of our own field-level checks ever run. Mirrored (read-only,
        // for visibility only - see comment there for why) as the "maxMediaFileSizeMb" setting
        // in default-settings-provider.service.ts; keep both parsing expressions in sync.
        limits: {
          fileSize: (() => {
            const parsedMb = Number(process.env.AB_MEDIA_MAX_FILE_SIZE_MB);
            return (Number.isFinite(parsedMb) && parsedMb > 0 ? parsedMb : 100) * 1024 * 1024;
          })(),
        },
      }),
      inject: [ConfigService],
    }),
    HttpModule,
    ConfigModule,
    ClsModule,
    JwtModule.register({
      global: true,
    }),
    TypeOrmModule.forFeature([DashboardUserLayout]),
  ],
  controllers: [
    ActionMetadataController,
    AuthenticationController,
    ChatterMessageController,
    ChatterMessageDetailsController,
    EmailTemplateController,
    ExportTemplateController,
    ExportTransactionController,
    FieldMetadataController,
    DashboardController,
    DatasourceManagementController,
    DatasourceIntrospectionController,
    GoogleAuthenticationController,
    FacebookAuthenticationController,
    MicrosoftAuthenticationController,
    MicrosoftActiveDirectoryAuthenticationController,
    ImportTransactionController,
    ImportTransactionErrorLogController,
    ListOfValuesController,
    LocaleController,
    MediaController,
    MediaStorageProviderMetadataController,
    MenuItemMetadataController,
    ModelMetadataController,
    ModuleMetadataExplorerController,
    ModuleMetadataController,
    ModulePackageController,
    MqMessageController,
    MqMessageQueueController,
    GupshupWebhookController,
    MetaCloudWhatsappWebhookController,
    OTPAuthenticationController,
    MpinAuthenticationController,
    PermissionMetadataController,
    RoleMetadataController,
    SavedFiltersController,
    ScheduledJobController,
    AgentSessionController,
    AgentEventController,
    McpAuditLogController,
    SecurityRuleController,
    ServiceController,
    SettingController,
    InfoController,
    SmsTemplateController,
    TestController,
    TestQueueController,
    TestRunController,
    UserActivityHistoryController,
    UserController,
    UserViewMetadataController,
    ViewMetadataController,
    ModelSequenceController,
    DashboardUserLayoutController,
    WorkflowDefinitionController,
    WorkflowExecutionController,
    WorkflowStepExecutionController,
    WorkflowExecutionLogController,
    WorkflowExecutionArtifactController,
    WorkflowTriggerExecutionController,
    WorkflowSecretController,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: HashingService,
      useClass: BcryptService,
    },
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    ModuleMetadataService,
    DatasourceManagementService,
    DatasourceIntrospectionService,
    ModuleMetadataExplorerService,
    ModuleMetadataHelperService,
    ModulePackageService,
    MetadataValidationService,
    ModelMetadataService,
    ModelMetadataHelperService,
    FieldMetadataService,
    DashboardRuntimeService,
    RemoveFieldsCommand,
    RefreshModelCommand,
    RefreshModuleCommand,
    InfoCommand,
    InfoService,
    SolidIntrospectService,
    DiscoveryService,
    DraftPublishHelperService,
    InternationalisationHelperService,
    CrudHelperService,
    CRUDService,
    Reflector,
    MetadataScanner,
    CommandService,
    SchematicService,
    MediaStorageProviderMetadataService,
    MediaService,
    MediaDownloadUrlService,
    // MediaStorageProviderMetadataSeederService,
    ModuleMetadataSeederService,
    ModuleTestDataService,
    ListOfValuesService,
    ListOfValuesSelectionProvider,
    MqDashboardQueueNameVariableOptionsProvider,
    MqDashboardMessageBrokerVariableOptionsProvider,
    PseudoForeignKeySelectionProvider,
    ModelMetadataSubscriber,
    ViewMetadataService,
    ActionMetadataService,
    MenuItemMetadataService,
    DiscoveryService,
    Reflector,
    MetadataScanner,
    DiskFileService,
    S3FileService,
    FileServiceFactory,
    DiskStoragePathBuilder,
    S3StoragePathBuilder,
    StoragePathBuilderFactory,
    TextractService,
    SolidRegistry,
    SeedCommand,
    TestCommand,
    TestDataCommand,
    TestRunCommand,
    McpCommand,
    SMTPEMailService,
    ElasticEmailService,
    Msg91SMSService,
    Msg91OTPService,
    Msg91WhatsappService,
    MetaCloudWhatsappService,
    GupshupOtpWhatsappService,
    TwilioSMSService,
    SmsTemplateService,
    EmailTemplateService,
    PublisherFactory,
    PollerService,
    ErrorMapperService,
    SolidCoreErrorCodesProvider,

    SmtpEmailQueuePublisherRabbitmq,
    SmtpEmailQueueSubscriberRabbitmq,
    SmtpEmailQueuePublisherDatabase,
    SmtpEmailQueueSubscriberDatabase,
    ApiEmailQueuePublisher,
    ApiEmailQueueSubscriber,
    ApiEmailQueuePublisherDatabase,
    ApiEmailQueueSubscriberDatabase,
    Msg91SmsQueuePublisher,
    Msg91SmsQueueSubscriber,
    Msg91SmsQueuePublisherDatabase,
    Msg91SmsQueueSubscriberDatabase,
    TwilioSmsQueuePublisherDatabase,
    TwilioSmsQueueSubscriberDatabase,
    TwilioSmsQueuePublisherRabbitmq,
    TwilioSmsQueueSubscriberRabbitmq,
    Msg91OTPQueuePublisher,
    Msg91OTPQueueSubscriber,
    OTPQueuePublisherDatabase,
    OTPQueueSubscriberDatabase,
    Msg91WhatsappQueuePublisher,
    Msg91WhatsappQueueSubscriber,
    Msg91WhatsappQueuePublisherDatabase,
    Msg91WhatsappQueueSubscriberDatabase,
    Three60WhatsappQueuePublisher,
    Three60WhatsappQueueSubscriber,
    Three60WhatsappQueuePublisherDatabase,
    Three60WhatsappQueueSubscriberDatabase,
    Three60WhatsappService,
    MqMessageService,
    MqMessageQueueService,
    TinyUrlService,
    PdfService,
    UuidExternalIdComputedFieldProvider,
    UuidExternalIdEntityComputedFieldProvider,
    ListOfModelsSelectionProvider,
    ListOfScheduledJobsSelectionProvider,
    LocaleListSelectionProvider,
    SoftDeleteAwareEventSubscriber,
    AccessTokenGuard,
    ApiKeyGuard,
    MediaSignedUrlGuard,
    ApiKeyService,
    MpinService,
    ActiveSessionStorageService,
    AccessTokenDenylistService,
    AuthenticationService,
    GoogleAuthenticationController,
    RefreshTokenIdsStorageService,
    SsoCodeStorageService,
    GoogleOauthStrategy,
    FacebookOAuthStrategy,
    MicrosoftOAuthStrategy,
    MicrosoftActiveDirectoryOAuthStrategy,
    UserRegistrationListener,
    TestQueuePublisher,
    TestQueueSubscriber,

    ChatterQueuePublisherRabbitmq,
    ChatterQueueSubscriberRabbitmq,
    ChatterQueuePublisherDatabase,
    ChatterQueueSubscriberDatabase,
    ChatterMentionNotificationEmailQueueHandler,
    ChatterMentionNotificationEmailQueuePublisherRabbitmq,
    ChatterMentionNotificationEmailQueueSubscriberRabbitmq,
    ChatterMentionNotificationEmailQueuePublisherDatabase,
    ChatterMentionNotificationEmailQueueSubscriberDatabase,

    TestQueuePublisherDatabase,
    TestQueueSubscriberDatabase,
    TestRunQueuePublisherDatabase,
    TestRunQueueSubscriberDatabase,
    TestQueuePublisherRedis,
    TestQueueSubscriberRedis,
    ApiEmailQueuePublisherRedis,
    ApiEmailQueueSubscriberRedis,
    ChatterQueuePublisherRedis,
    ChatterQueueSubscriberRedis,
    ChatterMentionNotificationEmailQueuePublisherRedis,
    ChatterMentionNotificationEmailQueueSubscriberRedis,
    ComputedFieldEvaluationPublisherRedis,
    ComputedFieldEvaluationSubscriberRedis,
    GenerateCodePublisherRedis,
    GenerateCodeSubscriberRedis,
    WorkflowExecutionPublisherRedis,
    WorkflowExecutionSubscriberRedis,
    Msg91OTPQueuePublisherRedis,
    Msg91OTPQueueSubscriberRedis,
    Msg91SmsQueuePublisherRedis,
    Msg91SmsQueueSubscriberRedis,
    Msg91WhatsappQueuePublisherRedis,
    Msg91WhatsappQueueSubscriberRedis,
    SmtpEmailQueuePublisherRedis,
    SmtpEmailQueueSubscriberRedis,
    Three60WhatsappQueuePublisherRedis,
    Three60WhatsappQueueSubscriberRedis,
    TwilioSmsQueuePublisherRedis,
    TwilioSmsQueueSubscriberRedis,
    GenerateCodePublisherDatabase,
    GenerateCodeSubscriberDatabase,
    GenerateCodePublisherRabbitmq,
    GenerateCodeSubscriberRabbitmq,
    WorkflowExecutionPublisherDatabase,
    WorkflowExecutionSubscriberDatabase,
    WorkflowExecutionPublisherRabbitmq,
    WorkflowExecutionSubscriberRabbitmq,
    Msg91OTPQueuePublisher,
    MqMessageQueueService,
    MqMessageService,
    ScheduledJobService,
    SchedulerServiceImpl,
    PermissionMetadataService,
    RoleMetadataService,
    PermissionMetadataSeederService,
    UserService,
    UserApiKeyRepository,
    UserDeviceCredentialRepository,
    UserRepository,
    SettingService,
    ConcatComputedFieldProvider,
    MqDashboardTotalMessagesKpiProvider,
    MqDashboardSucceededMessagesKpiProvider,
    MqDashboardFailedMessagesKpiProvider,
    MqDashboardInflightMessagesKpiProvider,
    MqDashboardSuccessRateKpiProvider,
    MqDashboardAvgElapsedKpiProvider,
    MqDashboardMessagesOverTimeProvider,
    MqDashboardStageDistributionProvider,
    MqDashboardQueueWiseFailuresProvider,
    MqDashboardQueueWiseAvgElapsedProvider,
    MqDashboardQueueSlaHeatmapProvider,
    MqDashboardLatencyTrendProvider,
    MqDashboardRecentFailuresProvider,
    FileStorageProvider,
    FileS3StorageProvider,
    MediaRepository,
    ViewMetadataSubsciber,
    SavedFiltersService,
    UserViewMetadataService,
    SecurityRuleService,
    SecurityRuleRepository,
    SecurityRuleSubscriber,
    RequestContextService,
    SavedFiltersService,
    ChatterMessageService,
    ChatterMessageDetailsService,
    LocaleService,
    AuditSubscriber,
    ExportTemplateService,
    ExportTransactionService,
    ExcelService,
    CsvService,
    DatasourceManagementService,
    DashboardRuntimeService,
    MssqlDatasourceIntrospectionProviderService,
    MysqlDatasourceIntrospectionProviderService,
    PostgresDatasourceIntrospectionProviderService,
    ImportTransactionService,
    ImportTransactionErrorLogService,
    CreatedByUpdatedBySubscriber,
    SystemFieldsSeederService,
    FieldMetadataRepository,
    ComputedEntityFieldSubscriber,
    ComputedFieldEvaluationPublisherDatabase,
    ComputedFieldEvaluationSubscriberDatabase,
    ComputedFieldEvaluationPublisherRabbitmq,
    ComputedFieldEvaluationSubscriberRabbitmq,
    ConcatEntityComputedFieldProvider,
    UserActivityHistoryService,
    NoopsEntityComputedFieldProviderService,

    SolidTsMorphService,

    ViewMetadataRepository,
    ScheduledJobRepository,
    AgentSessionRepository,
    AgentEventRepository,
    McpAuditLogRepository,
    AgentSessionService,
    AgentEventService,
    McpAuditLogService,
    ScheduledJobSubscriber,
    AlphaNumExternalIdComputationProvider,
    ListOfValuesSubscriber,
    ListOfValuesMapper,
    MailFactory,
    WhatsAppFactory,
    SmsFactory,
    ChatterMessageRepository,
    ChatterMessageDetailsRepository,
    EmailTemplateRepository,
    ExportTemplateRepository,
    ExportTransactionRepository,
    ImportTransactionErrorLogRepository,
    ImportTransactionRepository,
    ListOfValuesRepository,
    LocaleRepository,
    MenuItemMetadataRepository,
    MqMessageQueueRepository,
    MqMessageRepository,
    PermissionMetadataRepository,
    RoleMetadataRepository,
    SavedFiltersRepository,
    SettingRepository,
    SmsTemplateRepository,
    UserActivityHistoryRepository,
    UserViewMetadataRepository,
    ModelMetadataRepository,
    ModuleMetadataRepository,
    ActionMetadataRepository,
    MediaStorageProviderMetadataRepository,
    FixturesService,
    FixturesSetupCommand,
    FixturesTearDownCommand,
    SequenceNumComputedFieldProvider,
    ModelSequenceService,
    ModelSequenceRepository,
    SolidCoreDefaultSettingsProvider,
    ImageEncodingService,
    SolidMicroserviceAdapter,
    ListOfRolesSelectionProvider,
    DashboardUserLayoutService,
    DashboardUserLayoutRepository,
    WorkflowDefinitionService,
    WorkflowDefinitionMetadataSyncService,
    WorkflowDefinitionRepository,
    WorkflowExecutionService,
    WorkflowExecutionRepository,
    WorkflowStepExecutionService,
    WorkflowStepExecutionRepository,
    WorkflowExecutionLogService,
    WorkflowExecutionLogRepository,
    WorkflowExecutionArtifactService,
    WorkflowExecutionArtifactRepository,
    WorkflowTriggerExecutionService,
    WorkflowTriggerExecutionRepository,
    WorkflowSecretService,
    WorkflowSecretRepository,
    WorkflowInvocationService,
    WorkflowRuntimeService,
    WorkflowExecutionWriterService,
    WorkflowExpressionService,
    WorkflowDefinitionValidatorService,
    WorkflowNodeRegistryService,
    WorkflowScheduledTriggerJobService,
    ExecutionFailNode,
    LogWriteNode,
    HttpRequestNode,
    IfNode,
    ForEachNode,
    LoopUntilNode,
    ParallelNode,
    RuntimePythonNode,
    SequentialNode,
    SwitchNode,
    SolidXLoginNode,
    SolidXListNode,
    SolidXGetNode,
    SolidXCreateNode,
    SolidXUpdateNode,
    SolidXPatchNode,
    SolidXDeleteNode,
    SolidXSendEmailNode,
    SolidXSendSmsNode,
  ],
  exports: [
    // Exported for DI, not merely re-exported from index.ts: a consuming
    // project composing its own logout has to be able to inject this.
    AccessTokenDenylistService,
    AuthenticationService,
    ChatterMessageDetailsRepository,
    ChatterMessageDetailsService,
    ChatterMessageRepository,
    ChatterMessageService,
    ConfigModule,
    DraftPublishHelperService,
    InternationalisationHelperService,
    CrudHelperService,
    CRUDService,
    CsvService,
    DiscoveryService,
    EmailTemplateService,
    ElasticEmailService,
    ExcelService,
    FieldMetadataService,
    DiskFileService,
    S3FileService,
    FileServiceFactory,
    DiskStoragePathBuilder,
    S3StoragePathBuilder,
    StoragePathBuilderFactory,
    HttpModule,
    ImportTransactionService,
    ListOfValuesService,
    MailFactory,
    WhatsAppFactory,
    SmsFactory,
    MediaService,
    MediaStorageProviderMetadataService,
    MetadataValidationService,
    ModelMetadataHelperService,
    ModelMetadataService,
    ModuleMetadataService,
    DatasourceIntrospectionService,
    ModuleMetadataExplorerService,
    ModulePackageService,
    MqMessageQueueService,
    MqMessageService,
    Msg91OTPService,
    Msg91SMSService,
    Msg91WhatsappService,
    MulterModule,
    PdfService,
    PollerService,
    PublisherFactory,
    RefreshModelCommand,
    RefreshModuleCommand,
    RequestContextService,
    SchedulerServiceImpl,
    SecurityRuleRepository,
    SmsTemplateService,
    SMTPEMailService,
    SolidIntrospectService,
    SolidRegistry,
    TextractService,
    TinyUrlService,
    TwilioSMSService,
    TypeOrmModule,
    UserActivityHistoryService,
    ImageEncodingService,
    SolidMicroserviceAdapter,
    UserService,
    SettingService,
    WorkflowInvocationService,
    WorkflowRuntimeService,
    WorkflowNodeRegistryService,
    WorkflowExpressionService,
  ],
})
// Body-size limits live in bootstrapSolidApp (see SolidBootstrapOptions.bodyLimit).
// They cannot be applied here: module middleware is registered in registerRouter(),
// which runs after Nest's own parser middleware, so anything set here never takes effect.
export class SolidCoreModule {}
