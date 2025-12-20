import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  DiscoveryService,
  MetadataScanner,
  Reflector,
} from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemoveFieldsCommand } from './commands/remove-fields.command';
import appBuilderConfig from './config/app-builder.config';
import { FieldMetadataController } from './controllers/field-metadata.controller';
import { MediaStorageProviderMetadataController } from './controllers/media-storage-provider-metadata.controller';
import { ModelMetadataController } from './controllers/model-metadata.controller';
import { ModuleMetadataController } from './controllers/module-metadata.controller';
import { TestController } from './controllers/test.controller';
import { FieldMetadata } from './entities/field-metadata.entity';
import { ListOfValues } from './entities/list-of-values.entity';
import { MediaStorageProviderMetadata } from './entities/media-storage-provider-metadata.entity';
import { Media } from './entities/media.entity';
import { ModelMetadata } from './entities/model-metadata.entity';
import { ModuleMetadata } from './entities/module-metadata.entity';
import { CommandService } from './helpers/command.service';
import { SchematicService } from './helpers/schematic.service';
import { ListOfValuesSelectionProvider } from './services/selection-providers/list-of-values-selection-providers.service';
import { PseudoForeignKeySelectionProvider } from './services/selection-providers/pseudo-foreign-key-selection-provider.service'
import { ModuleMetadataSeederService } from './seeders/module-metadata-seeder.service';
import { CrudHelperService } from './services/crud-helper.service';
import { FieldMetadataService } from './services/field-metadata.service';
import { ListOfValuesService } from './services/list-of-values.service';
import { MediaStorageProviderMetadataSeederService } from './services/media-storage-provider-metadata-seeder.service';
import { MediaStorageProviderMetadataService } from './services/media-storage-provider-metadata.service';
import { MediaService } from './services/media.service';
import { ModelMetadataService } from './services/model-metadata.service';
import { ModuleMetadataService } from './services/module-metadata.service';
import { SolidIntrospectService } from './services/solid-introspect.service';
// import { ListOfComputedFieldProvider } from './providers/list-of-computed-field-provider.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { RefreshModelCommand } from './commands/refresh-model.command';
import { MediaController } from './controllers/media.controller';

import { RefreshModuleCommand } from './commands/refresh-module.command';
import { ModelMetadataSubscriber } from './subscribers/model-metadata.subscriber';

import { ViewMetadataController } from './controllers/view-metadata.controller';
import { ViewMetadata } from './entities/view-metadata.entity';
import { ViewMetadataService } from './services/view-metadata.service';

import { ActionMetadataController } from './controllers/action-metadata.controller';
import { ActionMetadata } from './entities/action-metadata.entity';
import { ActionMetadataService } from './services/action-metadata.service';

import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { SeedCommand } from './commands/seed.command';
import commonConfig from './config/common.config';
import { iamConfig } from './config/iam.config';
import { jwtConfig } from './config/jwt.config';
import { AuthenticationController } from './controllers/authentication.controller';
import { EmailTemplateController } from './controllers/email-template.controller';
import { GoogleAuthenticationController } from './controllers/google-authentication.controller';
import { MenuItemMetadataController } from './controllers/menu-item-metadata.controller';
import { MqMessageQueueController } from './controllers/mq-message-queue.controller';
import { MqMessageController } from './controllers/mq-message.controller';
import { OTPAuthenticationController } from './controllers/otp-authentication.controller';
import { ServiceController } from './controllers/service.controller';
import { SmsTemplateController } from './controllers/sms-template.controller';
import { TestQueueController } from './controllers/test-queue.controller';
import { EmailAttachment } from './entities/email-attachment.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { MenuItemMetadata } from './entities/menu-item-metadata.entity';
import { MqMessageQueue } from './entities/mq-message-queue.entity';
import { MqMessage } from './entities/mq-message.entity';
import { SmsTemplate } from './entities/sms-template.entity';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthenticationGuard } from './guards/authentication.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { SolidRegistry } from './helpers/solid-registry';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ApiEmailQueuePublisher } from './jobs/api-email-publisher.service';
import { ApiEmailQueueSubscriber } from './jobs/api-email-subscriber.service';
import { TestQueuePublisherDatabase } from './jobs/database/test-queue-publisher-database.service';
import { TestQueueSubscriberDatabase } from './jobs/database/test-queue-subscriber-database.service';
import { Msg91WhatsappQueuePublisher } from './jobs/msg91-whatsapp-publisher.service';
import { Msg91WhatsappQueueSubscriber } from './jobs/msg91-whatsapp-subscriber.service';
import { OTPQueuePublisher } from './jobs/otp-publisher.service';
import { OTPQueueSubscriber } from './jobs/otp-subscriber.service';
import { SmsQueuePublisher } from './jobs/sms-publisher.service';
import { SmsQueueSubscriber } from './jobs/sms-subscriber.service';
import { SmtpEmailQueuePublisherRabbitmq } from './jobs/smtp-email-publisher.service';
import { SmtpEmailQueueSubscriberRabbitmq } from './jobs/smtp-email-subscriber.service';
import { TestQueuePublisher } from './jobs/test-queue-publisher.service';
import { TestQueueSubscriber } from './jobs/test-queue-subscriber.service';
import { UserRegistrationListener } from './listeners/user-registration.listener';
import { GoogleOauthStrategy } from './passport-strategies/google-oauth.strategy';
import { LocalStrategy } from './passport-strategies/local.strategy';
import { EmailTemplateSeederService } from './seeders/email-template-seeder.service';
import { SmsTemplateSeederService } from './seeders/sms-template-seeder.service';
import { UserSeederService } from './seeders/user-seeder.service';
import { AuthenticationService } from './services/authentication.service';
import { BcryptService } from './services/bcrypt.service';
import { UuidExternalIdEntityComputedFieldProvider } from './services/computed-fields/entity/uuid-externalid-entity-computed-field-provider.service';
import { UuidExternalIdComputedFieldProvider } from './services/computed-fields/uuid-external-id-computed-field-provider.service';
import { EmailTemplateService } from './services/email-template.service';
import { FileService } from './services/file.service';
import { HashingService } from './services/hashing.service';
import { ElasticEmailService } from './services/mail/elastic-email.service';
import { SMTPEMailService } from './services/mail/smtp-email.service';
import { MenuItemMetadataService } from './services/menu-item-metadata.service';
import { MqMessageQueueService } from './services/mq-message-queue.service';
import { MqMessageService } from './services/mq-message.service';
import { PdfService } from './services/pdf.service';
import { RefreshTokenIdsStorageService } from './services/refresh-token-ids-storage.service';
import { ListOfModelsSelectionProvider } from './services/selection-providers/list-of-models-selection-provider.service';
import { TinyUrlService } from './services/short-url/tiny-url.service';
import { SmsTemplateService } from './services/sms-template.service';
import { Msg91OTPService } from './services/sms/Msg91OTPService';
import { Msg91SMSService } from './services/sms/Msg91SMSService';
// import { UserService } from './services/user.service';
import { Msg91WhatsappService } from './services/whatsapp/Msg91WhatsappService';
import { SoftDeleteAwareEventSubscriber } from './subscribers/soft-delete-aware-event.subscriber';

import { PermissionMetadataController } from './controllers/permission-metadata.controller';
import { PermissionMetadata } from './entities/permission-metadata.entity';
import { PermissionMetadataService } from './services/permission-metadata.service';

import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { AiInteractionController } from './controllers/ai-interaction.controller';
import { ChatterMessageDetailsController } from './controllers/chatter-message-details.controller';
import { ChatterMessageController } from './controllers/chatter-message.controller';
import { DashboardQuestionSqlDatasetConfigController } from './controllers/dashboard-question-sql-dataset-config.controller';
import { DashboardQuestionController } from './controllers/dashboard-question.controller';
import { DashboardVariableController } from './controllers/dashboard-variable.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { ExportTemplateController } from './controllers/export-template.controller';
import { ExportTransactionController } from './controllers/export-transaction.controller';
import { ImportTransactionErrorLogController } from './controllers/import-transaction-error-log.controller';
import { ImportTransactionController } from './controllers/import-transaction.controller';
import { ListOfValuesController } from './controllers/list-of-values.controller';
import { LocaleController } from './controllers/locale.controller';
import { RoleMetadataController } from './controllers/role-metadata.controller';
import { SavedFiltersController } from './controllers/saved-filters.controller';
import { ScheduledJobController } from './controllers/scheduled-job.controller';
import { SecurityRuleController } from './controllers/security-rule.controller';
import { SettingController } from './controllers/setting.controller';
import { UserActivityHistoryController } from './controllers/user-activity-history.controller';
import { UserViewMetadataController } from './controllers/user-view-metadata.controller';
import { UserController } from './controllers/user.controller';
import { AiInteraction } from './entities/ai-interaction.entity';
import { ChatterMessageDetails } from './entities/chatter-message-details.entity';
import { ChatterMessage } from './entities/chatter-message.entity';
import { DashboardQuestionSqlDatasetConfig } from './entities/dashboard-question-sql-dataset-config.entity';
import { DashboardQuestion } from './entities/dashboard-question.entity';
import { DashboardVariable } from './entities/dashboard-variable.entity';
import { Dashboard } from './entities/dashboard.entity';
import { ExportTemplate } from './entities/export-template.entity';
import { ExportTransaction } from './entities/export-transaction.entity';
import { ImportTransactionErrorLog } from './entities/import-transaction-error-log.entity';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Locale } from './entities/locale.entity';
import { RoleMetadata } from './entities/role-metadata.entity';
import { SavedFilters } from './entities/saved-filters.entity';
import { ScheduledJob } from './entities/scheduled-job.entity';
import { SecurityRule } from './entities/security-rule.entity';
import { Setting } from './entities/setting.entity';
import { UserActivityHistory } from './entities/user-activity-history.entity';
import { UserViewMetadata } from './entities/user-view-metadata.entity';
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
import { SmsQueuePublisherDatabase } from './jobs/database/sms-publisher-database.service';
import { SmsQueueSubscriberDatabase } from './jobs/database/sms-subscriber-database.service';
import { SmtpEmailQueuePublisherDatabase } from './jobs/database/smtp-email-publisher-database.service';
import { SmtpEmailQueueSubscriberDatabase } from './jobs/database/smtp-email-subscriber-database.service';

import { TwilioSmsQueuePublisherDatabase } from './jobs/database/twilio-sms-publisher-database.service';
import { TwilioSmsQueueSubscriberDatabase } from './jobs/database/twilio-sms-subscriber-database.service';


// import { ThrottlerModule } from '@nestjs/throttler';
import { IngestCommand } from './commands/ingest.command';
import { MailFactory } from './factories/mail.factory';
import { ErrorMapperService } from './helpers/error-mapper.service';
import { SolidCoreErrorCodesProvider } from './helpers/solid-core-error-codes-provider.service';
import { ComputedFieldEvaluationPublisherRabbitmq } from './jobs/computed-field-evaluation-publisher.service';
import { ComputedFieldEvaluationSubscriberRabbitmq } from './jobs/computed-field-evaluation-subscriber.service';
import { Msg91WhatsappQueuePublisherDatabase } from './jobs/database/msg91-whatsapp-publisher-database.service';
import { Msg91WhatsappQueueSubscriberDatabase } from './jobs/database/msg91-whatsapp-subscriber-database.service';
import { Three60WhatsappQueuePublisherDatabase } from './jobs/database/three60-whatsapp-publisher-database.service';
import { Three60WhatsappQueueSubscriberDatabase } from './jobs/database/three60-whatsapp-subscriber-database.service';
import { TriggerMcpClientPublisherDatabase } from './jobs/database/trigger-mcp-client-publisher-database.service';
import { TriggerMcpClientSubscriberDatabase } from './jobs/database/trigger-mcp-client-subscriber-database.service';
import { GenerateCodePublisherRabbitmq } from './jobs/generate-code-publisher.service';
import { GenerateCodeSubscriberRabbitmq } from './jobs/generate-code-subscriber.service';
import { Three60WhatsappQueuePublisher } from './jobs/three60-whatsapp-publisher.service';
import { Three60WhatsappQueueSubscriber } from './jobs/three60-whatsapp-subscriber.service';
import { TriggerMcpClientPublisherRabbitmq } from './jobs/trigger-mcp-client-publisher.service';
import { TriggerMcpClientSubscriberRabbitmq } from './jobs/trigger-mcp-client-subscriber.service';
import { TwilioSmsQueuePublisherRabbitmq } from './jobs/twilio-sms-publisher.service';
import { TwilioSmsQueueSubscriberRabbitmq } from './jobs/twilio-sms-subscriber.service';
import { DashboardMapper } from './mappers/dashboard-mapper';
import { ListOfValuesMapper } from './mappers/list-of-values-mapper';
import { ActionMetadataRepository } from './repository/action-metadata.repository';
import { AiInteractionRepository } from './repository/ai-interaction.repository';
import { ChatterMessageDetailsRepository } from './repository/chatter-message-details.repository';
import { ChatterMessageRepository } from './repository/chatter-message.repository';
import { DashboardQuestionSqlDatasetConfigRepository } from './repository/dashboard-question-sql-dataset-config.repository';
import { DashboardQuestionRepository } from './repository/dashboard-question.repository';
import { DashboardVariableRepository } from './repository/dashboard-variable.repository';
import { DashboardRepository } from './repository/dashboard.repository';
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
import { SecurityRuleRepository } from './repository/security-rule.repository';
import { SettingRepository } from './repository/setting.repository';
import { SmsTemplateRepository } from './repository/sms-template.repository';
import { UserActivityHistoryRepository } from './repository/user-activity-history.repository';
import { UserViewMetadataRepository } from './repository/user-view-metadata.repository';
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
import { NoopsEntityComputedFieldProviderService } from './services/computed-fields/entity/noops-entity-computed-field-provider.service';
import { CRUDService } from './services/crud.service';
import { CsvService } from './services/csv.service';
import { DashboardQuestionSqlDatasetConfigService } from './services/dashboard-question-sql-dataset-config.service';
import { DashboardQuestionService } from './services/dashboard-question.service';
import { DashboardVariableSQLDynamicProvider } from './services/dashboard-selection-providers/dashboard-variable-sql-dynamic-provider.service';
import { DasbhoardVariableTestDynamicProvider } from './services/dashboard-selection-providers/dashboard-variable-test-dynamic-provider.service';
import { DashboardVariableService } from './services/dashboard-variable.service';
import { DashboardService } from './services/dashboard.service';
import { ExcelService } from './services/excel.service';
import { ExportTemplateService } from './services/export-template.service';
import { ExportTransactionService } from './services/export-transaction.service';
import { IngestMetadataService } from './services/genai/ingest-metadata.service';
import { McpHandlerFactory } from './services/genai/mcp-handlers/mcp-handler-factory.service';
import { SolidAddButtonToFormViewMcpHandler } from './services/genai/mcp-handlers/solid-add-button-to-form-view-mcp-handler.service';
import { SolidAddControllerHandlerMcpHandler } from './services/genai/mcp-handlers/solid-add-controller-handler-method-mcp-handler.service';
import { SolidAddCustomServiceMethodMcpHandler } from './services/genai/mcp-handlers/solid-add-custom-service-method-mcp-handler.service';
import { SolidAddFieldsToModelMcpHandler } from './services/genai/mcp-handlers/solid-add-fields-to-model-mcp-handler.service';
import { SolidAddHeaderButtonOrRowButtonToListViewMcpHandler } from './services/genai/mcp-handlers/solid-add-header-button-or-row-button-to-list-view-mcp-handler.service';
import { SolidAddQuestionToDashboardMcpHandler } from './services/genai/mcp-handlers/solid-add-question-to-dashboard-mcp-handler.service';
import { SolidAddVariableToDashboardMcpHandler } from './services/genai/mcp-handlers/solid-add-variable-to-dashboard-mcp-handler.service';
import { SolidCreateComputedProviderMcpHandler } from './services/genai/mcp-handlers/solid-create-computed-provider-mcp-handler.service';
import { SolidCreateCustomFormViewWidgetMcpHandler } from './services/genai/mcp-handlers/solid-create-custom-form-view-widget-mcp-handler.service';
import { SolidCreateDashboardWithWidgetsMcpHandler } from './services/genai/mcp-handlers/solid-create-dashboard-mcp-handler.service';
import { SolidCreateDashboardQuestionMcpHandler } from './services/genai/mcp-handlers/solid-create-dashboard-question-mcp-handler.service';
import { SolidCreateDashboardQuestionSqlDatasetConfigMcpHandler } from './services/genai/mcp-handlers/solid-create-dashboard-question-sql-dataset-config-mcp-handler.service';
import { SolidCreateDashboardWidgetMcpHandler } from './services/genai/mcp-handlers/solid-create-dashboard-widget-mcp-handler.service';
import { SolidCreateModelWithFieldsMcpHandler } from './services/genai/mcp-handlers/solid-create-model-with-fields-mcp-handler.service';
import { SolidCreateModuleMcpHandler } from './services/genai/mcp-handlers/solid-create-module-mcp-handler.service';
import { SolidUpdateLayoutMcpHandler } from './services/genai/mcp-handlers/solid-update-layout-mcp-handler.service';
import { R2RHelperService } from './services/genai/r2r-helper.service';
import { ImportTransactionErrorLogService } from './services/import-transaction-error-log.service';
import { ImportTransactionService } from './services/import-transaction.service';
import { LocaleService } from './services/locale.service';
import { FileS3StorageProvider } from './services/mediaStorageProviders/file-s3-storage-provider';
import { FileStorageProvider } from './services/mediaStorageProviders/file-storage-provider';
import { PollerService } from './services/poller.service';
import { ChartJsSqlDataProvider } from './services/question-data-providers/chartjs-sql-data-provider.service';
import { PrimeReactDatatableSqlDataProvider } from './services/question-data-providers/prime-react-datatable-sql-data-provider.service';
import { PrimeReactMeterGroupSqlDataProvider } from './services/question-data-providers/prime-react-meter-group-sql-data-provider.service';
import { PublisherFactory } from './services/queues/publisher-factory.service';
import { RequestContextService } from './services/request-context.service';
import { RoleMetadataService } from './services/role-metadata.service';
import { SavedFiltersService } from './services/saved-filters.service';
import { ScheduledJobService } from './services/scheduled-job.service';
import { SchedulerServiceImpl } from './services/scheduled-jobs/scheduler.service';
import { SecurityRuleService } from './services/security-rule.service';
import { ListOfDashboardQuestionProvidersSelectionProvider } from './services/selection-providers/list-of-dashboard-question-providers-selection-provider.service';
import { ListOfDashboardVariableProvidersSelectionProvider } from './services/selection-providers/list-of-dashboard-variable-providers-selection-provider.service';
import { ListOfScheduledJobsSelectionProvider } from './services/selection-providers/list-of-scheduled-jobs-selection-provider.service';
import { LocaleListSelectionProvider } from './services/selection-providers/locale-list-selection-provider.service';
import { SettingService } from './services/setting.service';
import { TwilioSMSService } from './services/sms/TwilioSMSService';
import { SolidTsMorphService } from './services/solid-ts-morph.service';
import { SqlExpressionResolverService } from './services/sql-expression-resolver.service';
import { TextractService } from './services/textract.service';
import { UserActivityHistoryService } from './services/user-activity-history.service';
import { UserViewMetadataService } from './services/user-view-metadata.service';
import { UserService } from './services/user.service';
import { Three60WhatsappService } from './services/whatsapp/Three60WhatsappService';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import { ComputedEntityFieldSubscriber } from './subscribers/computed-entity-field.subscriber';
import { CreatedByUpdatedBySubscriber } from './subscribers/created-by-updated-by.subscriber';
import { DashboardQuestionSqlDatasetConfigSubscriber } from './subscribers/dashboard-question-sql-dataset-config.subscriber';
import { DashboardQuestionSubscriber } from './subscribers/dashboard-question.subscriber';
import { DashboardVariableSubscriber } from './subscribers/dashboard-variable.subscriber';
import { DashboardSubscriber } from './subscribers/dashboard.subscriber';
import { ListOfValuesSubscriber } from './subscribers/list-of-values.subscriber';
import { ScheduledJobSubscriber } from './subscribers/scheduled-job.subscriber';
import { SecurityRuleSubscriber } from './subscribers/security-rule.subscriber';
import { ViewMetadataSubsciber } from './subscribers/view-metadata.subscriber';
import { MediaStorageProviderMetadataRepository } from './repository/media-storage-provider-metadata.repository';
import { McpCommand } from './commands/mcp.command';
import { DatabaseBootstrapService } from './services/database/database-bootstrap.service';


@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActionMetadata,
      AiInteraction,
      ChatterMessage,
      ChatterMessageDetails,
      Dashboard,
      DashboardQuestion,
      DashboardQuestionSqlDatasetConfig,
      DashboardVariable,
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
      SecurityRule,
      Setting,
      SmsTemplate,
      User,
      UserActivityHistory,
      UserViewMetadata,
      ViewMetadata,
    ]),
    ConfigModule.forFeature(appBuilderConfig),
    ConfigModule.forFeature(commonConfig),
    ConfigModule.forFeature(iamConfig),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'media-files-storage'),
      serveRoot: '/media-files-storage',
      serveStaticOptions: {
        setHeaders: (res /*, path, stat*/) => {
          // Allow use of these files from a different origin (e.g., :3000 UI)
          // Use 'same-site' if both origins are on the same site (localhost:* counts as same-site)
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // or 'same-site'

          // If you need to load into <canvas> without tainting or fetch images via XHR,
          // you can also expose CORS here (not needed for simple <img>):
          // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
        },
      }
    }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        dest: configService.get<string>('app-builder.uploadDir'),
      }),
      inject: [ConfigService],
    }),
    HttpModule,
    ConfigModule,
    ClsModule,
  ],
  controllers: [
    ActionMetadataController,
    AiInteractionController,
    AuthenticationController,
    ChatterMessageController,
    ChatterMessageDetailsController,
    DashboardController,
    DashboardQuestionController,
    DashboardQuestionSqlDatasetConfigController,
    DashboardVariableController,
    EmailTemplateController,
    ExportTemplateController,
    ExportTransactionController,
    FieldMetadataController,
    GoogleAuthenticationController,
    ImportTransactionController,
    ImportTransactionErrorLogController,
    ListOfValuesController,
    LocaleController,
    MediaController,
    MediaStorageProviderMetadataController,
    MenuItemMetadataController,
    ModelMetadataController,
    ModuleMetadataController,
    MqMessageController,
    MqMessageQueueController,
    OTPAuthenticationController,
    PermissionMetadataController,
    RoleMetadataController,
    SavedFiltersController,
    ScheduledJobController,
    SecurityRuleController,
    ServiceController,
    SettingController,
    SmsTemplateController,
    TestController,
    TestQueueController,
    UserActivityHistoryController,
    UserController,
    UserViewMetadataController,
    ViewMetadataController,
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
      useClass: HttpExceptionFilter
    },
    ModuleMetadataService,
    ModuleMetadataHelperService,
    ModelMetadataService,
    ModelMetadataHelperService,
    FieldMetadataService,
    RemoveFieldsCommand,
    RefreshModelCommand,
    RefreshModuleCommand,
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
    MediaStorageProviderMetadataSeederService,
    ModuleMetadataSeederService,
    ListOfValuesService,
    ListOfValuesSelectionProvider,
    PseudoForeignKeySelectionProvider,
    ModelMetadataSubscriber,
    ViewMetadataService,
    ActionMetadataService,
    MenuItemMetadataService,
    DiscoveryService,
    Reflector,
    MetadataScanner,
    FileService,
    TextractService,
    SolidRegistry,
    SeedCommand,
    McpCommand,
    IngestCommand,
    IngestMetadataService,
    SMTPEMailService,
    ElasticEmailService,
    Msg91SMSService,
    Msg91OTPService,
    Msg91WhatsappService,
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
    SmsQueuePublisher,
    SmsQueueSubscriber,
    SmsQueuePublisherDatabase,
    SmsQueueSubscriberDatabase,
    TwilioSmsQueuePublisherDatabase,
    TwilioSmsQueueSubscriberDatabase,
    TwilioSmsQueuePublisherRabbitmq,
    TwilioSmsQueueSubscriberRabbitmq,
    OTPQueuePublisher,
    OTPQueueSubscriber,
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
    EmailTemplateSeederService,
    SmsTemplateSeederService,
    TinyUrlService,
    PdfService,
    UuidExternalIdComputedFieldProvider,
    UuidExternalIdEntityComputedFieldProvider,
    ListOfModelsSelectionProvider,
    ListOfScheduledJobsSelectionProvider,
    LocaleListSelectionProvider,
    SoftDeleteAwareEventSubscriber,
    AccessTokenGuard,
    AuthenticationService,
    GoogleAuthenticationController,
    RefreshTokenIdsStorageService,
    UserSeederService,
    LocalStrategy,
    GoogleOauthStrategy,
    UserRegistrationListener,
    TestQueuePublisher,
    TestQueueSubscriber,

    // ChatterQueuePublisher,
    // ChatterQueueSubscriber,

    TestQueuePublisherDatabase,
    TestQueueSubscriberDatabase,
    GenerateCodePublisherDatabase,
    GenerateCodeSubscriberDatabase,
    GenerateCodePublisherRabbitmq,
    GenerateCodeSubscriberRabbitmq,
    OTPQueuePublisher,
    MqMessageQueueService,
    MqMessageService,
    ScheduledJobService,
    SchedulerServiceImpl,
    PermissionMetadataService,
    RoleMetadataService,
    PermissionMetadataSeederService,
    UserService,
    UserRepository,
    SettingService,
    ConcatComputedFieldProvider,
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
    DashboardService,
    DashboardVariableService,
    DashboardQuestionService,
    DashboardVariableSQLDynamicProvider,
    DasbhoardVariableTestDynamicProvider,
    ListOfDashboardVariableProvidersSelectionProvider,
    ListOfDashboardQuestionProvidersSelectionProvider,
    DashboardQuestionSqlDatasetConfigService,
    ChartJsSqlDataProvider,
    PrimeReactMeterGroupSqlDataProvider,
    PrimeReactDatatableSqlDataProvider,
    SqlExpressionResolverService,
    AiInteractionService,
    DashboardMapper,
    DashboardRepository,
    DashboardSubscriber,
    DashboardVariableSubscriber,
    DashboardQuestionSubscriber,
    DashboardQuestionSqlDatasetConfigSubscriber,
    NoopsEntityComputedFieldProviderService,

    McpHandlerFactory,
    SolidCreateModuleMcpHandler,
    SolidCreateModelWithFieldsMcpHandler,
    SolidAddFieldsToModelMcpHandler,
    SolidUpdateLayoutMcpHandler,

    SolidCreateDashboardWithWidgetsMcpHandler,
    SolidCreateDashboardQuestionMcpHandler,
    SolidCreateDashboardQuestionSqlDatasetConfigMcpHandler,
    SolidCreateDashboardWidgetMcpHandler,
    SolidCreateComputedProviderMcpHandler,
    SolidAddVariableToDashboardMcpHandler,
    SolidAddQuestionToDashboardMcpHandler,

    SolidAddCustomServiceMethodMcpHandler,
    SolidAddHeaderButtonOrRowButtonToListViewMcpHandler,
    SolidAddControllerHandlerMcpHandler,
    SolidAddButtonToFormViewMcpHandler,
    SolidCreateCustomFormViewWidgetMcpHandler,

    SolidTsMorphService,

    ViewMetadataRepository,
    ScheduledJobRepository,
    ScheduledJobSubscriber,
    AlphaNumExternalIdComputationProvider,
    ListOfValuesSubscriber,
    ListOfValuesMapper,
    MailFactory,
    ChatterMessageRepository,
    ChatterMessageDetailsRepository,
    AiInteractionRepository,
    DashboardQuestionSqlDatasetConfigRepository,
    DashboardQuestionRepository,
    DashboardVariableRepository,
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
    DatabaseBootstrapService
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
    FileService,
    HttpModule,
    ImportTransactionService,
    ListOfValuesService,
    MailFactory,
    MediaService,
    MediaStorageProviderMetadataService,
    ModelMetadataHelperService,
    ModelMetadataService,
    ModuleMetadataService,
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
    UserSeederService,
  ],
})
export class SolidCoreModule { }
