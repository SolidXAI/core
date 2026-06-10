import "multer";
import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import * as express from "express";
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
import { CrudHelperService } from "./services/crud-helper.service";
import { FieldMetadataService } from "./services/field-metadata.service";
import { DashboardRuntimeService } from "./services/dashboard-runtime.service";
import { ListOfValuesService } from "./services/list-of-values.service";
// import { MediaStorageProviderMetadataSeederService } from './services/media-storage-provider-metadata-seeder.service';
import { MediaStorageProviderMetadataService } from "./services/media-storage-provider-metadata.service";
import { MediaService } from "./services/media.service";
import { ModelMetadataService } from "./services/model-metadata.service";
import { ModuleMetadataExplorerService } from "./services/module-metadata-explorer.service";
import { ModuleMetadataService } from "./services/module-metadata.service";
import { ModulePackageService } from "./services/module-package.service";
import { SolidIntrospectService } from "./services/solid-introspect.service";
// import { ListOfComputedFieldProvider } from './providers/list-of-computed-field-provider.service';
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { RefreshModelCommand } from "./commands/refresh-model.command";
import { MediaController } from "./controllers/media.controller";

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
import { FacebookOAuthStrategy } from "./passport-strategies/facebook-oauth.strategy";
import { MicrosoftOAuthStrategy } from "./passport-strategies/microsoft-oauth.strategy";

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
import { OTPAuthenticationController } from "./controllers/otp-authentication.controller";
import { ServiceController } from "./controllers/service.controller";
import { SmsTemplateController } from "./controllers/sms-template.controller";
import { TestQueueController } from "./controllers/test-queue.controller";
import { EmailAttachment } from "./entities/email-attachment.entity";
import { EmailTemplate } from "./entities/email-template.entity";
import { MenuItemMetadata } from "./entities/menu-item-metadata.entity";
import { MqMessageQueue } from "./entities/mq-message-queue.entity";
import { MqMessage } from "./entities/mq-message.entity";
import { SmsTemplate } from "./entities/sms-template.entity";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { AuthenticationGuard } from "./guards/authentication.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { SolidRegistry } from "./helpers/solid-registry";
import { LoggingInterceptor } from "./interceptors/logging.interceptor";
import { ApiEmailQueuePublisher } from "./jobs/rabbitmq/api-email-publisher.service";
import { ApiEmailQueueSubscriber } from "./jobs/rabbitmq/api-email-subscriber.service";
import { TestQueuePublisherDatabase } from "./jobs/database/test-queue-publisher-database.service";
import { TestQueueSubscriberDatabase } from "./jobs/database/test-queue-subscriber-database.service";
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
import { ApiEmailQueuePublisherRedis } from "./jobs/redis/api-email-publisher-redis.service";
import { ApiEmailQueueSubscriberRedis } from "./jobs/redis/api-email-subscriber-redis.service";
import { ChatterQueuePublisherRedis } from "./jobs/redis/chatter-queue-publisher-redis.service";
import { ChatterQueueSubscriberRedis } from "./jobs/redis/chatter-queue-subscriber-redis.service";
import { ComputedFieldEvaluationPublisherRedis } from "./jobs/redis/computed-field-evaluation-publisher-redis.service";
import { ComputedFieldEvaluationSubscriberRedis } from "./jobs/redis/computed-field-evaluation-subscriber-redis.service";
import { GenerateCodePublisherRedis } from "./jobs/redis/generate-code-publisher-redis.service";
import { GenerateCodeSubscriberRedis } from "./jobs/redis/generate-code-subscriber-redis.service";
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
import { TriggerMcpClientPublisherRedis } from "./jobs/redis/trigger-mcp-client-publisher-redis.service";
import { TriggerMcpClientSubscriberRedis } from "./jobs/redis/trigger-mcp-client-subscriber-redis.service";
import { TwilioSmsQueuePublisherRedis } from "./jobs/redis/twilio-sms-publisher-redis.service";
import { TwilioSmsQueueSubscriberRedis } from "./jobs/redis/twilio-sms-subscriber-redis.service";
import { UserRegistrationListener } from "./listeners/user-registration.listener";
import { GoogleOauthStrategy } from "./passport-strategies/google-oauth.strategy";
import { ApiKeyService } from "./services/api-key.service";
import { AuthenticationService } from "./services/authentication.service";
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
import { AiInteractionController } from "./controllers/ai-interaction.controller";
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
import { AiInteraction } from './entities/ai-interaction.entity';
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
import { OTPQueuePublisherDatabase } from './jobs/database/otp-publisher-database.service';
import { OTPQueueSubscriberDatabase } from './jobs/database/otp-subscriber-database.service';
import { Msg91SmsQueuePublisherDatabase } from './jobs/database/msg91-sms-publisher-database.service';
import { Msg91SmsQueueSubscriberDatabase } from './jobs/database/msg91-sms-subscriber-database.service';
import { SmtpEmailQueuePublisherDatabase } from './jobs/database/smtp-email-publisher-database.service';
import { SmtpEmailQueueSubscriberDatabase } from './jobs/database/smtp-email-subscriber-database.service';

import { TwilioSmsQueuePublisherDatabase } from "./jobs/database/twilio-sms-publisher-database.service";
import { TwilioSmsQueueSubscriberDatabase } from "./jobs/database/twilio-sms-subscriber-database.service";

// import { ThrottlerModule } from '@nestjs/throttler';
import { IngestCommand } from "./commands/ingest.command";
import { MailFactory } from "./factories/mail.factory";
import { ErrorMapperService } from "./helpers/error-mapper.service";
import { SolidCoreErrorCodesProvider } from "./helpers/solid-core-error-codes-provider.service";
import { ComputedFieldEvaluationPublisherRabbitmq } from "./jobs/rabbitmq/computed-field-evaluation-publisher.service";
import { ComputedFieldEvaluationSubscriberRabbitmq } from "./jobs/rabbitmq/computed-field-evaluation-subscriber.service";
import { Msg91WhatsappQueuePublisherDatabase } from "./jobs/database/msg91-whatsapp-publisher-database.service";
import { Msg91WhatsappQueueSubscriberDatabase } from "./jobs/database/msg91-whatsapp-subscriber-database.service";
import { Three60WhatsappQueuePublisherDatabase } from "./jobs/database/three60-whatsapp-publisher-database.service";
import { Three60WhatsappQueueSubscriberDatabase } from "./jobs/database/three60-whatsapp-subscriber-database.service";
import { TriggerMcpClientPublisherDatabase } from "./jobs/database/trigger-mcp-client-publisher-database.service";
import { TriggerMcpClientSubscriberDatabase } from "./jobs/database/trigger-mcp-client-subscriber-database.service";
import { GenerateCodePublisherRabbitmq } from "./jobs/rabbitmq/generate-code-publisher.service";
import { GenerateCodeSubscriberRabbitmq } from "./jobs/rabbitmq/generate-code-subscriber.service";
import { Three60WhatsappQueuePublisher } from "./jobs/rabbitmq/three60-whatsapp-publisher.service";
import { Three60WhatsappQueueSubscriber } from "./jobs/rabbitmq/three60-whatsapp-subscriber.service";
import { TriggerMcpClientPublisherRabbitmq } from "./jobs/rabbitmq/trigger-mcp-client-publisher.service";
import { TriggerMcpClientSubscriberRabbitmq } from "./jobs/rabbitmq/trigger-mcp-client-subscriber.service";
import { TwilioSmsQueuePublisherRabbitmq } from "./jobs/rabbitmq/twilio-sms-publisher.service";
import { TwilioSmsQueueSubscriberRabbitmq } from "./jobs/rabbitmq/twilio-sms-subscriber.service";
import { ListOfValuesMapper } from "./mappers/list-of-values-mapper";
import { ActionMetadataRepository } from "./repository/action-metadata.repository";
import { AiInteractionRepository } from "./repository/ai-interaction.repository";
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
import { UserRepository } from './repository/user.repository';
import { ViewMetadataRepository } from './repository/view-metadata.repository';
import { PermissionMetadataSeederService } from './seeders/permission-metadata-seeder.service';
import { SystemFieldsSeederService } from './seeders/system-fields-seeder.service';
import { AiInteractionService } from './services/ai-interaction.service';
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
import { IngestMetadataService } from './services/genai/ingest-metadata.service';
import { McpHandlerFactory } from './services/genai/mcp-handlers/mcp-handler-factory.service';
import { R2RHelperService } from './services/genai/r2r-helper.service';
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

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActionMetadata,
      AiInteraction,
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
      UserActivityHistory,
      UserViewMetadata,
      ViewMetadata,
      ModelSequence,
    ]),

    CacheModule.registerAsync(CacheManagerOptions),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "media-files-storage"),
      serveRoot: "/media-files-storage",
      serveStaticOptions: {
        setHeaders: (res /*, path, stat*/) => {
          // Allow use of these files from a different origin (e.g., :3000 UI)
          // Use 'same-site' if both origins are on the same site (localhost:* counts as same-site)
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); // or 'same-site'

          // If you need to load into <canvas> without tainting or fetch images via XHR,
          // you can also expose CORS here (not needed for simple <img>):
          // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
        },
      },
    }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        dest: process.env.AB_MEDIA_UPLOAD_DIR ?? "media-uploads",
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
    AiInteractionController,
    AuthenticationController,
    ChatterMessageController,
    ChatterMessageDetailsController,
    EmailTemplateController,
    ExportTemplateController,
    ExportTransactionController,
    FieldMetadataController,
    DashboardController,
    GoogleAuthenticationController,
    FacebookAuthenticationController,
    MicrosoftAuthenticationController,
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
    UserActivityHistoryController,
    UserController,
    UserViewMetadataController,
    ViewMetadataController,
    ModelSequenceController,
    DashboardUserLayoutController,
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
    ModuleMetadataExplorerService,
    ModuleMetadataHelperService,
    ModulePackageService,
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
    R2RHelperService,
    CrudHelperService,
    CRUDService,
    Reflector,
    MetadataScanner,
    CommandService,
    SchematicService,
    MediaStorageProviderMetadataService,
    MediaService,
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
    IngestCommand,
    IngestMetadataService,
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

    TriggerMcpClientPublisherDatabase,
    TriggerMcpClientSubscriberDatabase,
    TriggerMcpClientPublisherRabbitmq,
    TriggerMcpClientSubscriberRabbitmq,

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
    ApiKeyService,
    AuthenticationService,
    GoogleAuthenticationController,
    RefreshTokenIdsStorageService,
    SsoCodeStorageService,
    GoogleOauthStrategy,
    FacebookOAuthStrategy,
    MicrosoftOAuthStrategy,
    UserRegistrationListener,
    TestQueuePublisher,
    TestQueueSubscriber,

    ChatterQueuePublisherRabbitmq,
    ChatterQueueSubscriberRabbitmq,
    ChatterQueuePublisherDatabase,
    ChatterQueueSubscriberDatabase,

    TestQueuePublisherDatabase,
    TestQueueSubscriberDatabase,
    TestQueuePublisherRedis,
    TestQueueSubscriberRedis,
    ApiEmailQueuePublisherRedis,
    ApiEmailQueueSubscriberRedis,
    ChatterQueuePublisherRedis,
    ChatterQueueSubscriberRedis,
    ComputedFieldEvaluationPublisherRedis,
    ComputedFieldEvaluationSubscriberRedis,
    GenerateCodePublisherRedis,
    GenerateCodeSubscriberRedis,
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
    TriggerMcpClientPublisherRedis,
    TriggerMcpClientSubscriberRedis,
    TwilioSmsQueuePublisherRedis,
    TwilioSmsQueueSubscriberRedis,
    GenerateCodePublisherDatabase,
    GenerateCodeSubscriberDatabase,
    GenerateCodePublisherRabbitmq,
    GenerateCodeSubscriberRabbitmq,
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
    DashboardRuntimeService,
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
    AiInteractionService,
    NoopsEntityComputedFieldProviderService,

    McpHandlerFactory,

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
    AiInteractionRepository,
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
  ],
  exports: [
    AiInteractionService,
    AuthenticationService,
    ChatterMessageDetailsRepository,
    ChatterMessageDetailsService,
    ChatterMessageRepository,
    ChatterMessageService,
    ConfigModule,
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
    ModelMetadataHelperService,
    ModelMetadataService,
    ModuleMetadataService,
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
  ],
})
export class SolidCoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        express.json({ limit: "10mb" }),
        express.urlencoded({ limit: "10mb", extended: true }),
      )
      .forRoutes("*");
  }
}
