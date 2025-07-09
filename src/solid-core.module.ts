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
import { ListOfValuesSelectionProvider } from './providers/list-of-values-selection-providers.service';
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
import { iamConfig, jwtConfig } from './config/iam.config';
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
// import { UserController } from './controllers/user.controller';
import { EmailAttachment } from './entities/email-attachment.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { MenuItemMetadata } from './entities/menu-item-metadata.entity';
import { MqMessageQueue } from './entities/mq-message-queue.entity';
import { MqMessage } from './entities/mq-message.entity';
import { SmsTemplate } from './entities/sms-template.entity';
import { UserPasswordHistory } from './entities/user-password-history.entity';
// import { User } from './entities/user.entity';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthenticationGuard } from './guards/authentication.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { SolidRegistry } from './helpers/solid-registry';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ApiEmailQueuePublisher } from './jobs/api-email-publisher.service';
import { ApiEmailQueueSubscriber } from './jobs/api-email-subscriber.service';
import { TestQueuePublisherDatabase } from './jobs/database/test-queue-publisher-database.service';
import { TestQueueSubscriberDatabase } from './jobs/database/test-queue-subscriber-database.service';
import { EmailQueuePublisher } from './jobs/email-publisher.service';
import { EmailQueueSubscriber } from './jobs/email-subscriber.service';
import { OTPQueuePublisher } from './jobs/otp-publisher.service';
import { OTPQueueSubscriber } from './jobs/otp-subscriber.service';
import { SmsQueuePublisher } from './jobs/sms-publisher.service';
import { SmsQueueSubscriber } from './jobs/sms-subscriber.service';
import { TestQueuePublisher } from './jobs/test-queue-publisher.service';
import { TestQueueSubscriber } from './jobs/test-queue-subscriber.service';
import { WhatsappQueuePublisher } from './jobs/whatsapp-publisher.service';
import { WhatsappQueueSubscriber } from './jobs/whatsapp-subscriber.service';
import { UserRegistrationListener } from './listeners/user-registration.listener';
import { GoogleOauthStrategy } from './passport-strategies/google-oauth.strategy';
import { LocalStrategy } from './passport-strategies/local.strategy';
import { EmailTemplateSeederService } from './seeders/email-template-seeder.service';
import { SmsTemplateSeederService } from './seeders/sms-template-seeder.service';
import { UserSeederService } from './seeders/user-seeder.service';
import { AuthenticationService } from './services/authentication.service';
import { BcryptService } from './services/bcrypt.service';
import { UuidExternalIdComputedFieldProvider } from './services/computed-fields/uuid-external-id-computed-field-provider.service';
import { EmailTemplateService } from './services/email-template.service';
import { FileService } from './services/file.service';
import { HashingService } from './services/hashing.service';
import { ElasticEmailService } from './services/mail/ElasticEmailService';
import { SMTPEMailService } from './services/mail/SMTPEmailService';
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

import { ClsModule } from 'nestjs-cls';
import { ChatterMessageDetailsController } from './controllers/chatter-message-details.controller';
import { ChatterMessageController } from './controllers/chatter-message.controller';
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
import { SecurityRule } from './entities/security-rule.entity';
import { Setting } from './entities/setting.entity';
import { UserActivityHistory } from './entities/user-activity-history.entity';
import { UserViewMetadata } from './entities/user-view-metadata.entity';
import { User } from './entities/user.entity';
import { ModelMetadataHelperService } from './helpers/model-metadata-helper.service';
import { ModuleMetadataHelperService } from './helpers/module-metadata-helper.service';
import { ApiEmailQueuePublisherDatabase } from './jobs/database/api-email-publisher-database.service';
import { ApiEmailQueueSubscriberDatabase } from './jobs/database/api-email-subscriber-database.service';
import { ComputedFieldEvaluationPublisher } from './jobs/database/computed-field-evaluation-publisher.service';
import { ComputedFieldEvaluationSubscriber } from './jobs/database/computed-field-evaluation-subscriber.service';
import { EmailQueuePublisherDatabase } from './jobs/database/email-publisher-database.service';
import { EmailQueueSubscriberDatabase } from './jobs/database/email-subscriber-database.service';
import { GenerateCodePublisherDatabase } from './jobs/database/generate-code-publisher-database.service';
import { GenerateCodeSubscriberDatabase } from './jobs/database/generate-code-subscriber-database.service';
import { OTPQueuePublisherDatabase } from './jobs/database/otp-publisher-database.service';
import { OTPQueueSubscriberDatabase } from './jobs/database/otp-subscriber-database.service';
import { SmsQueuePublisherDatabase } from './jobs/database/sms-publisher-database.service';
import { SmsQueueSubscriberDatabase } from './jobs/database/sms-subscriber-database.service';
import { WhatsappQueuePublisherDatabase } from './jobs/database/whatsapp-publisher-database.service';
import { WhatsappQueueSubscriberDatabase } from './jobs/database/whatsapp-subscriber-database.service';
import { FieldMetadataRepository } from './repository/field-metadata.repository';
import { FieldRepository } from './repository/field.repository';
import { MediaRepository } from './repository/media.repository';
import { SecurityRuleRepository } from './repository/security-rule.repository';
import { PermissionMetadataSeederService } from './seeders/permission-metadata-seeder.service';
import { SystemFieldsSeederService } from './seeders/system-fields-seeder.service';
import { ChatterMessageDetailsService } from './services/chatter-message-details.service';
import { ChatterMessageService } from './services/chatter-message.service';
import { ConcatComputedFieldProvider } from './services/computed-fields/concat-computed-field-provider.service';
import { ConcatEntityComputedFieldProvider } from './services/computed-fields/entity/concat-entity-computed-field-provider.service';
import { CsvService } from './services/csv.service';
import { ExcelService } from './services/excel.service';
import { ExportTemplateService } from './services/export-template.service';
import { ExportTransactionService } from './services/export-transaction.service';
import { ImportTransactionErrorLogService } from './services/import-transaction-error-log.service';
import { ImportTransactionService } from './services/import-transaction.service';
import { LocaleService } from './services/locale.service';
import { FileS3StorageProvider } from './services/mediaStorageProviders/file-s3-storage-provider';
import { FileStorageProvider } from './services/mediaStorageProviders/file-storage-provider';
import { PublisherFactory } from './services/queues/publisher-factory.service';
import { RequestContextService } from './services/request-context.service';
import { RoleMetadataService } from './services/role-metadata.service';
import { SavedFiltersService } from './services/saved-filters.service';
import { ScheduledJobService } from './services/scheduled-job.service';
import { SchedulerServiceImpl } from './services/scheduled-jobs/scheduler.service';
import { SecurityRuleService } from './services/security-rule.service';
import { ListOfScheduledJobsSelectionProvider } from './services/selection-providers/list-of-scheduled-jobs-selection-provider.service';
import { LocaleListSelectionProvider } from './services/selection-providers/locale-list-selection-provider.service';
import { SettingService } from './services/setting.service';
import { UserActivityHistoryService } from './services/user-activity-history.service';
import { UserViewMetadataService } from './services/user-view-metadata.service';
import { UserService } from './services/user.service';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import { ComputedEntityFieldSubscriber } from './subscribers/computed-entity-field.subscriber';
import { CreatedByUpdatedBySubscriber } from './subscribers/created-by-updated-by.subscriber';
import { SecurityRuleSubscriber } from './subscribers/security-rule.subscriber';
import { ViewMetadataSubsciber } from './subscribers/view-metadata.subscriber';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardService } from './services/dashboard.service';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardVariable } from './entities/dashboard-variable.entity';
import { DashboardVariableService } from './services/dashboard-variable.service';
import { DashboardVariableController } from './controllers/dashboard-variable.controller';
import { Question } from './entities/question.entity';
import { QuestionService } from './services/question.service';
import { QuestionController } from './controllers/question.controller';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { DashboardVariableSQLDynamicProvider } from './services/dashboard-selection-providers/dashboard-variable-sql-dynamic-provider.service';
import { DasbhoardVariableTestDynamicProvider } from './services/dashboard-selection-providers/dashboard-variable-test-dynamic-provider.service';
import { ListOfDashboardVariableProvidersSelectionProvider } from './services/selection-providers/list-of-dashboard-variable-providers-selection-provider.service';
import { ListOfDashboardQuestionProvidersSelectionProvider } from './services/selection-providers/list-of-dashboard-question-providers-selection-provider.service';
import { QuestionSqlDatasetConfig } from './entities/question-sql-dataset-config.entity';
import { QuestionSqlDatasetConfigService } from './services/question-sql-dataset-config.service';
import { QuestionSqlDatasetConfigController } from './controllers/question-sql-dataset-config.controller';


@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModelMetadata,
      FieldMetadata,
      ModuleMetadata,
      ListOfValues,
      MediaStorageProviderMetadata,
      Media,
      EmailTemplate,
      SmsTemplate,
      EmailAttachment,
      User,
      UserPasswordHistory,
      ViewMetadata,
      ActionMetadata,
      MenuItemMetadata,
      MqMessageQueue,
      MqMessage,
      ScheduledJob,
      PermissionMetadata,
      RoleMetadata,
      Setting,
      SavedFilters,
      UserViewMetadata,
      SecurityRule,
      ListOfValues,
      ChatterMessage,
      ChatterMessageDetails,
      Locale,
      ExportTemplate,
      ExportTransaction,
      ImportTransaction,
      ImportTransactionErrorLog,
      UserActivityHistory,
    ]),
    ConfigModule.forFeature(appBuilderConfig),
    ConfigModule.forFeature(commonConfig),
    ConfigModule.forFeature(iamConfig),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'media-files-storage'),
      serveRoot: '/media-files-storage',
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
    TypeOrmModule.forFeature([Dashboard]),
    TypeOrmModule.forFeature([DashboardVariable]),
    TypeOrmModule.forFeature([Question]),
    TypeOrmModule.forFeature([QuestionSqlDatasetConfig]),
  ],
  controllers: [
    ModuleMetadataController,
    ModelMetadataController,
    FieldMetadataController,
    TestController,
    MediaController,
    MediaStorageProviderMetadataController,
    ViewMetadataController,
    ActionMetadataController,
    MenuItemMetadataController,
    ServiceController,
    SmsTemplateController,
    EmailTemplateController,
    AuthenticationController,
    GoogleAuthenticationController,
    OTPAuthenticationController,
    TestQueueController,
    MqMessageQueueController,
    MqMessageController,
    ScheduledJobController,
    PermissionMetadataController,
    RoleMetadataController,
    UserController,
    SettingController,
    SavedFiltersController,
    UserViewMetadataController,
    SecurityRuleController,
    SavedFiltersController,
    ListOfValuesController,
    ChatterMessageController,
    ChatterMessageDetailsController,
    LocaleController,
    ExportTemplateController,
    ExportTransactionController,
    ImportTransactionController,
    ImportTransactionErrorLogController,
    UserActivityHistoryController,
    DashboardController,
    DashboardVariableController,
    QuestionController,
    QuestionSqlDatasetConfigController,
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
    CrudHelperService,
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
    ModelMetadataSubscriber,
    ViewMetadataService,
    ActionMetadataService,
    MenuItemMetadataService,
    DiscoveryService,
    Reflector,
    MetadataScanner,
    FileService,
    SolidRegistry,
    SeedCommand,
    SMTPEMailService,
    ElasticEmailService,
    Msg91SMSService,
    Msg91OTPService,
    Msg91WhatsappService,
    SmsTemplateService,
    EmailTemplateService,
    PublisherFactory,
    EmailQueuePublisher,
    EmailQueueSubscriber,
    EmailQueuePublisherDatabase,
    EmailQueueSubscriberDatabase,
    ApiEmailQueuePublisher,
    ApiEmailQueueSubscriber,
    ApiEmailQueuePublisherDatabase,
    ApiEmailQueueSubscriberDatabase,
    SmsQueuePublisher,
    SmsQueueSubscriber,
    SmsQueuePublisherDatabase,
    SmsQueueSubscriberDatabase,
    OTPQueuePublisher,
    OTPQueueSubscriber,
    OTPQueuePublisherDatabase,
    OTPQueueSubscriberDatabase,
    WhatsappQueuePublisher,
    WhatsappQueueSubscriber,
    WhatsappQueuePublisherDatabase,
    WhatsappQueueSubscriberDatabase,
    EmailTemplateSeederService,
    SmsTemplateSeederService,
    TinyUrlService,
    PdfService,
    UuidExternalIdComputedFieldProvider,
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
    TestQueuePublisherDatabase,
    TestQueueSubscriberDatabase,
    GenerateCodePublisherDatabase,
    GenerateCodeSubscriberDatabase,
    MqMessageQueueService,
    MqMessageService,
    ScheduledJobService,
    SchedulerServiceImpl,
    PermissionMetadataService,
    RoleMetadataService,
    PermissionMetadataSeederService,
    UserService,
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
    FieldRepository,
    ImportTransactionService,
    ImportTransactionErrorLogService,
    CreatedByUpdatedBySubscriber,
    SystemFieldsSeederService,
    FieldMetadataRepository,
    ComputedEntityFieldSubscriber,
    ComputedFieldEvaluationPublisher,
    ComputedFieldEvaluationSubscriber,
    ConcatEntityComputedFieldProvider,
    UserActivityHistoryService,
    DashboardService,
    DashboardVariableService,
    QuestionService,
    DashboardVariableSQLDynamicProvider,
    DasbhoardVariableTestDynamicProvider,
    ListOfDashboardVariableProvidersSelectionProvider,
    ListOfDashboardQuestionProvidersSelectionProvider,
    QuestionSqlDatasetConfigService,
  ],
  exports: [
    ModuleMetadataService,
    ModelMetadataService,
    FieldMetadataService,
    MediaStorageProviderMetadataService,
    MediaService,
    DiscoveryService,
    CrudHelperService,
    MulterModule,
    FileService,
    SolidRegistry,
    SMTPEMailService,
    ElasticEmailService,
    Msg91SMSService,
    Msg91OTPService,
    Msg91WhatsappService,
    TinyUrlService,
    PdfService,
    EmailTemplateService,
    SmsTemplateService,
    UserSeederService,
    AuthenticationService,
    MqMessageQueueService,
    MqMessageService,
    RefreshModelCommand,
    RefreshModuleCommand,
    RequestContextService,
    SecurityRuleRepository,
    FieldRepository,
    SchedulerServiceImpl,
    UserActivityHistoryService,
  ],
})
export class SolidCoreModule { }
