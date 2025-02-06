import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
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
import { ModelSubscriber } from './subscribers/model.subscriber';

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
import { QueuesTestController } from './controllers/queues-test.controller';
import { ServiceController } from './controllers/service.controller';
import { SmsTemplateController } from './controllers/sms-template.controller';
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
import { EmailQueuePublisher } from './jobs/email-publisher.service';
import { EmailQueueSubscriber } from './jobs/email-subscriber.service';
import { OTPQueuePublisher } from './jobs/otp-publisher.service';
import { OTPQueueSubscriber } from './jobs/otp-subscriber.service';
import { TestQueuePublisher } from './jobs/queue-test-publisher.service';
import { TestQueueSubscriber } from './jobs/queue-test-subscriber.service';
import { SmsQueuePublisher } from './jobs/sms-publisher.service';
import { SmsQueueSubscriber } from './jobs/sms-subscriber.service';
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
import { SoftDeleteAwareEventSubscriber } from './subscribers/softDeleteAwareEventSubscriber.subscriber';

import { PermissionMetadataController } from './controllers/permission-metadata.controller';
import { PermissionMetadata } from './entities/permission-metadata.entity';
import { PermissionMetadataService } from './services/permission-metadata.service';

import { RoleMetadataController } from './controllers/role-metadata.controller';
import { UserController } from './controllers/user.controller';
import { RoleMetadata } from './entities/role-metadata.entity';
import { User } from './entities/user.entity';
import { PermissionMetadataSeederService } from './seeders/permission-metadata-seeder.service';
import { RoleMetadataService } from './services/role-metadata.service';
import { UserService } from './services/user.service';
import { Setting } from './entities/setting.entity';
import { SettingService } from './services/setting.service';
import { SettingController } from './controllers/setting.controller';
import { ModuleMetadataHelperService } from './helpers/module-metadata-helper.service';
import { ConcatComputedFieldProvider } from './services/computed-fields/concat-computed-field-provider.service';
import { FileS3StorageProvider } from './services/mediaStorageProviders/file-s3-storage-provider';
import { FileStorageProvider } from './services/mediaStorageProviders/file-storage-provider';
import { MediaRepository } from './repository/media.repository';
import { ViewMetadataSubsciber } from './subscribers/view-metadata.subscriber';
import { SavedFilters } from './entities/saved-filters.entity';
import { SavedFiltersService } from './services/saved-filters.service';
import { SavedFiltersController } from './controllers/saved-filters.controller';
import { UserViewMetadata } from './entities/user-view-metadata.entity';
import { UserViewMetadataService } from './services/user-view-metadata.service';
import { UserViewMetadataController } from './controllers/user-view-metadata.controller';
import { SecurityRule } from './entities/security-rule.entity';
import { SecurityRuleService } from './services/security-rule.service';
import { SecurityRuleController } from './controllers/security-rule.controller';
import { RequestContextService } from './services/request-context.service';
import { SecurityRuleRepository } from './repository/security-rule.repository';
import { SecurityRuleSubscriber } from './subscribers/security-rule.subscriber';
import { ListOfValuesController } from './controllers/list-of-values.controller';
import { ChatterMessage } from './entities/chatter-message.entity';
import { ChatterMessageService } from './services/chatter-message.service';
import { ChatterMessageController } from './controllers/chatter-message.controller';
import { ChatterMessageDetails } from './entities/chatter-message-details.entity';
import { ChatterMessageDetailsService } from './services/chatter-message-details.service';
import { ChatterMessageDetailsController } from './controllers/chatter-message-details.controller';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import { UserContextService } from './services/user-context.service';
import { ExportTemplate } from './entities/export-template.entity';
import { ExportTemplateService } from './services/export-template.service';
import { ExportTemplateController } from './controllers/export-template.controller';
import { ExportTransaction } from './entities/export-transaction.entity';
import { ExportTransactionService } from './services/export-transaction.service';
import { ExportTransactionController } from './controllers/export-transaction.controller';
import { ExcelService } from './services/excel.service';
import { CsvService } from './services/csv.service';


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
      PermissionMetadata,
      RoleMetadata
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
    TypeOrmModule.forFeature([Setting]),
    TypeOrmModule.forFeature([SavedFilters]),
    TypeOrmModule.forFeature([UserViewMetadata]),
    TypeOrmModule.forFeature([SecurityRule]),
    TypeOrmModule.forFeature([SavedFilters]),
    TypeOrmModule.forFeature([ListOfValues]),
    TypeOrmModule.forFeature([ChatterMessage]),
    TypeOrmModule.forFeature([ChatterMessageDetails]),
    TypeOrmModule.forFeature([ExportTemplate]),
    TypeOrmModule.forFeature([ExportTransaction]),
    // TypeOrmModule.forFeature([User]),
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
    QueuesTestController,
    MqMessageQueueController,
    MqMessageController,
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
    ExportTemplateController,
    ExportTransactionController,
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
    ModuleMetadataService,
    ModuleMetadataHelperService,
    ModelMetadataService,
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
    ModelSubscriber,
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
    EmailQueuePublisher,
    EmailQueueSubscriber,
    ApiEmailQueuePublisher,
    ApiEmailQueueSubscriber,
    SmsQueuePublisher,
    SmsQueueSubscriber,
    OTPQueuePublisher,
    OTPQueueSubscriber,
    WhatsappQueuePublisher,
    WhatsappQueueSubscriber,
    EmailTemplateSeederService,
    SmsTemplateSeederService,
    TinyUrlService,
    PdfService,
    UuidExternalIdComputedFieldProvider,
    ListOfModelsSelectionProvider,
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
    MqMessageQueueService,
    MqMessageService,
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
    AuditSubscriber,
    UserContextService,
    ExportTemplateService,
    ExportTransactionService,
    ExcelService,
    CsvService,
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
  ],
})
export class SolidCoreModule { }
