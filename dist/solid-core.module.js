"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolidCoreModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const platform_express_1 = require("@nestjs/platform-express");
const typeorm_1 = require("@nestjs/typeorm");
const remove_fields_command_1 = require("./commands/remove-fields.command");
const app_builder_config_1 = require("./config/app-builder.config");
const field_metadata_controller_1 = require("./controllers/field-metadata.controller");
const media_storage_provider_metadata_controller_1 = require("./controllers/media-storage-provider-metadata.controller");
const model_metadata_controller_1 = require("./controllers/model-metadata.controller");
const module_metadata_controller_1 = require("./controllers/module-metadata.controller");
const test_controller_1 = require("./controllers/test.controller");
const field_metadata_entity_1 = require("./entities/field-metadata.entity");
const list_of_values_entity_1 = require("./entities/list-of-values.entity");
const media_storage_provider_metadata_entity_1 = require("./entities/media-storage-provider-metadata.entity");
const media_entity_1 = require("./entities/media.entity");
const model_metadata_entity_1 = require("./entities/model-metadata.entity");
const module_metadata_entity_1 = require("./entities/module-metadata.entity");
const command_service_1 = require("./helpers/command.service");
const schematic_service_1 = require("./helpers/schematic.service");
const list_of_values_selection_providers_service_1 = require("./providers/list-of-values-selection-providers.service");
const module_metadata_seeder_service_1 = require("./seeders/module-metadata-seeder.service");
const crud_helper_service_1 = require("./services/crud-helper.service");
const field_metadata_service_1 = require("./services/field-metadata.service");
const list_of_values_service_1 = require("./services/list-of-values.service");
const media_storage_provider_metadata_seeder_service_1 = require("./services/media-storage-provider-metadata-seeder.service");
const media_storage_provider_metadata_service_1 = require("./services/media-storage-provider-metadata.service");
const media_service_1 = require("./services/media.service");
const model_metadata_service_1 = require("./services/model-metadata.service");
const module_metadata_service_1 = require("./services/module-metadata.service");
const solid_introspect_service_1 = require("./services/solid-introspect.service");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const refresh_model_command_1 = require("./commands/refresh-model.command");
const media_controller_1 = require("./controllers/media.controller");
const refresh_module_command_1 = require("./commands/refresh-module.command");
const model_subscriber_1 = require("./subscribers/model.subscriber");
const view_metadata_controller_1 = require("./controllers/view-metadata.controller");
const view_metadata_entity_1 = require("./entities/view-metadata.entity");
const view_metadata_service_1 = require("./services/view-metadata.service");
const action_metadata_controller_1 = require("./controllers/action-metadata.controller");
const action_metadata_entity_1 = require("./entities/action-metadata.entity");
const action_metadata_service_1 = require("./services/action-metadata.service");
const axios_1 = require("@nestjs/axios");
const jwt_1 = require("@nestjs/jwt");
const seed_command_1 = require("./commands/seed.command");
const common_config_1 = require("./config/common.config");
const iam_config_1 = require("./config/iam.config");
const authentication_controller_1 = require("./controllers/authentication.controller");
const email_template_controller_1 = require("./controllers/email-template.controller");
const google_authentication_controller_1 = require("./controllers/google-authentication.controller");
const menu_item_metadata_controller_1 = require("./controllers/menu-item-metadata.controller");
const mq_message_queue_controller_1 = require("./controllers/mq-message-queue.controller");
const mq_message_controller_1 = require("./controllers/mq-message.controller");
const otp_authentication_controller_1 = require("./controllers/otp-authentication.controller");
const queues_test_controller_1 = require("./controllers/queues-test.controller");
const service_controller_1 = require("./controllers/service.controller");
const sms_template_controller_1 = require("./controllers/sms-template.controller");
const email_attachment_entity_1 = require("./entities/email-attachment.entity");
const email_template_entity_1 = require("./entities/email-template.entity");
const menu_item_metadata_entity_1 = require("./entities/menu-item-metadata.entity");
const mq_message_queue_entity_1 = require("./entities/mq-message-queue.entity");
const mq_message_entity_1 = require("./entities/mq-message.entity");
const sms_template_entity_1 = require("./entities/sms-template.entity");
const user_password_history_entity_1 = require("./entities/user-password-history.entity");
const access_token_guard_1 = require("./guards/access-token.guard");
const authentication_guard_1 = require("./guards/authentication.guard");
const permissions_guard_1 = require("./guards/permissions.guard");
const solid_registry_1 = require("./helpers/solid-registry");
const logging_interceptor_1 = require("./interceptors/logging.interceptor");
const api_email_publisher_service_1 = require("./jobs/api-email-publisher.service");
const api_email_subscriber_service_1 = require("./jobs/api-email-subscriber.service");
const email_publisher_service_1 = require("./jobs/email-publisher.service");
const email_subscriber_service_1 = require("./jobs/email-subscriber.service");
const otp_publisher_service_1 = require("./jobs/otp-publisher.service");
const otp_subscriber_service_1 = require("./jobs/otp-subscriber.service");
const queue_test_publisher_service_1 = require("./jobs/queue-test-publisher.service");
const queue_test_subscriber_service_1 = require("./jobs/queue-test-subscriber.service");
const sms_publisher_service_1 = require("./jobs/sms-publisher.service");
const sms_subscriber_service_1 = require("./jobs/sms-subscriber.service");
const whatsapp_publisher_service_1 = require("./jobs/whatsapp-publisher.service");
const whatsapp_subscriber_service_1 = require("./jobs/whatsapp-subscriber.service");
const user_registration_listener_1 = require("./listeners/user-registration.listener");
const google_oauth_strategy_1 = require("./passport-strategies/google-oauth.strategy");
const local_strategy_1 = require("./passport-strategies/local.strategy");
const email_template_seeder_service_1 = require("./seeders/email-template-seeder.service");
const sms_template_seeder_service_1 = require("./seeders/sms-template-seeder.service");
const user_seeder_service_1 = require("./seeders/user-seeder.service");
const authentication_service_1 = require("./services/authentication.service");
const bcrypt_service_1 = require("./services/bcrypt.service");
const uuid_external_id_computed_field_provider_service_1 = require("./services/computed-fields/uuid-external-id-computed-field-provider.service");
const email_template_service_1 = require("./services/email-template.service");
const file_service_1 = require("./services/file.service");
const hashing_service_1 = require("./services/hashing.service");
const ElasticEmailService_1 = require("./services/mail/ElasticEmailService");
const SMTPEmailService_1 = require("./services/mail/SMTPEmailService");
const menu_item_metadata_service_1 = require("./services/menu-item-metadata.service");
const mq_message_queue_service_1 = require("./services/mq-message-queue.service");
const mq_message_service_1 = require("./services/mq-message.service");
const pdf_service_1 = require("./services/pdf.service");
const refresh_token_ids_storage_service_1 = require("./services/refresh-token-ids-storage.service");
const list_of_models_selection_provider_service_1 = require("./services/selection-providers/list-of-models-selection-provider.service");
const tiny_url_service_1 = require("./services/short-url/tiny-url.service");
const sms_template_service_1 = require("./services/sms-template.service");
const Msg91OTPService_1 = require("./services/sms/Msg91OTPService");
const Msg91SMSService_1 = require("./services/sms/Msg91SMSService");
const Msg91WhatsappService_1 = require("./services/whatsapp/Msg91WhatsappService");
const softDeleteAwareEventSubscriber_subscriber_1 = require("./subscribers/softDeleteAwareEventSubscriber.subscriber");
const permission_metadata_entity_1 = require("./entities/permission-metadata.entity");
const permission_metadata_service_1 = require("./services/permission-metadata.service");
const permission_metadata_controller_1 = require("./controllers/permission-metadata.controller");
const role_metadata_entity_1 = require("./entities/role-metadata.entity");
const role_metadata_service_1 = require("./services/role-metadata.service");
const role_metadata_controller_1 = require("./controllers/role-metadata.controller");
const permission_metadata_seeder_service_1 = require("./seeders/permission-metadata-seeder.service");
const user_entity_1 = require("./entities/user.entity");
const user_service_1 = require("./services/user.service");
const user_controller_1 = require("./controllers/user.controller");
let SolidCoreModule = class SolidCoreModule {
};
exports.SolidCoreModule = SolidCoreModule;
exports.SolidCoreModule = SolidCoreModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                model_metadata_entity_1.ModelMetadata,
                field_metadata_entity_1.FieldMetadata,
                module_metadata_entity_1.ModuleMetadata,
                list_of_values_entity_1.ListOfValues,
                media_storage_provider_metadata_entity_1.MediaStorageProviderMetadata,
                media_entity_1.Media,
                email_template_entity_1.EmailTemplate,
                sms_template_entity_1.SmsTemplate,
                email_attachment_entity_1.EmailAttachment,
                user_password_history_entity_1.UserPasswordHistory,
                view_metadata_entity_1.ViewMetadata,
                action_metadata_entity_1.ActionMetadata,
                menu_item_metadata_entity_1.MenuItemMetadata,
                mq_message_queue_entity_1.MqMessageQueue,
                mq_message_entity_1.MqMessage,
                permission_metadata_entity_1.PermissionMetadata,
                role_metadata_entity_1.RoleMetadata
            ]),
            config_1.ConfigModule.forFeature(app_builder_config_1.default),
            config_1.ConfigModule.forFeature(common_config_1.default),
            config_1.ConfigModule.forFeature(iam_config_1.iamConfig),
            config_1.ConfigModule.forFeature(iam_config_1.jwtConfig),
            jwt_1.JwtModule.registerAsync(iam_config_1.jwtConfig.asProvider()),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(process.cwd(), 'media-files-storage'),
                serveRoot: '/media-files-storage',
            }),
            platform_express_1.MulterModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => ({
                    dest: configService.get('app-builder.uploadDir'),
                }),
                inject: [config_1.ConfigService],
            }),
            axios_1.HttpModule,
            config_1.ConfigModule,
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User]),
        ],
        controllers: [
            module_metadata_controller_1.ModuleMetadataController,
            model_metadata_controller_1.ModelMetadataController,
            field_metadata_controller_1.FieldMetadataController,
            test_controller_1.TestController,
            media_controller_1.MediaController,
            media_storage_provider_metadata_controller_1.MediaStorageProviderMetadataController,
            view_metadata_controller_1.ViewMetadataController,
            action_metadata_controller_1.ActionMetadataController,
            menu_item_metadata_controller_1.MenuItemMetadataController,
            service_controller_1.ServiceController,
            sms_template_controller_1.SmsTemplateController,
            email_template_controller_1.EmailTemplateController,
            authentication_controller_1.AuthenticationController,
            google_authentication_controller_1.GoogleAuthenticationController,
            otp_authentication_controller_1.OTPAuthenticationController,
            queues_test_controller_1.QueuesTestController,
            mq_message_queue_controller_1.MqMessageQueueController,
            mq_message_controller_1.MqMessageController,
            permission_metadata_controller_1.PermissionMetadataController,
            role_metadata_controller_1.RoleMetadataController,
            user_controller_1.UserController,
        ],
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: logging_interceptor_1.LoggingInterceptor,
            },
            {
                provide: hashing_service_1.HashingService,
                useClass: bcrypt_service_1.BcryptService,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: authentication_guard_1.AuthenticationGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: permissions_guard_1.PermissionsGuard,
            },
            module_metadata_service_1.ModuleMetadataService,
            model_metadata_service_1.ModelMetadataService,
            field_metadata_service_1.FieldMetadataService,
            remove_fields_command_1.RemoveFieldsCommand,
            refresh_model_command_1.RefreshModelCommand,
            refresh_module_command_1.RefreshModuleCommand,
            solid_introspect_service_1.SolidIntrospectService,
            core_1.DiscoveryService,
            crud_helper_service_1.CrudHelperService,
            core_1.Reflector,
            core_1.MetadataScanner,
            command_service_1.CommandService,
            schematic_service_1.SchematicService,
            media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService,
            media_service_1.MediaService,
            media_storage_provider_metadata_seeder_service_1.MediaStorageProviderMetadataSeederService,
            module_metadata_seeder_service_1.ModuleMetadataSeederService,
            list_of_values_service_1.ListOfValuesService,
            list_of_values_selection_providers_service_1.ListOfValuesSelectionProvider,
            model_subscriber_1.ModelSubscriber,
            view_metadata_service_1.ViewMetadataService,
            action_metadata_service_1.ActionMetadataService,
            menu_item_metadata_service_1.MenuItemMetadataService,
            core_1.DiscoveryService,
            core_1.Reflector,
            core_1.MetadataScanner,
            file_service_1.FileService,
            solid_registry_1.SolidRegistry,
            seed_command_1.SeedCommand,
            SMTPEmailService_1.SMTPEMailService,
            ElasticEmailService_1.ElasticEmailService,
            Msg91SMSService_1.Msg91SMSService,
            Msg91OTPService_1.Msg91OTPService,
            Msg91WhatsappService_1.Msg91WhatsappService,
            sms_template_service_1.SmsTemplateService,
            email_template_service_1.EmailTemplateService,
            email_publisher_service_1.EmailQueuePublisher,
            email_subscriber_service_1.EmailQueueSubscriber,
            api_email_publisher_service_1.ApiEmailQueuePublisher,
            api_email_subscriber_service_1.ApiEmailQueueSubscriber,
            sms_publisher_service_1.SmsQueuePublisher,
            sms_subscriber_service_1.SmsQueueSubscriber,
            otp_publisher_service_1.OTPQueuePublisher,
            otp_subscriber_service_1.OTPQueueSubscriber,
            whatsapp_publisher_service_1.WhatsappQueuePublisher,
            whatsapp_subscriber_service_1.WhatsappQueueSubscriber,
            email_template_seeder_service_1.EmailTemplateSeederService,
            sms_template_seeder_service_1.SmsTemplateSeederService,
            tiny_url_service_1.TinyUrlService,
            pdf_service_1.PdfService,
            uuid_external_id_computed_field_provider_service_1.UuidExternalIdComputedFieldProvider,
            list_of_models_selection_provider_service_1.ListOfModelsSelectionProvider,
            softDeleteAwareEventSubscriber_subscriber_1.SoftDeleteAwareEventSubscriber,
            access_token_guard_1.AccessTokenGuard,
            authentication_service_1.AuthenticationService,
            google_authentication_controller_1.GoogleAuthenticationController,
            refresh_token_ids_storage_service_1.RefreshTokenIdsStorageService,
            user_seeder_service_1.UserSeederService,
            local_strategy_1.LocalStrategy,
            google_oauth_strategy_1.GoogleOauthStrategy,
            user_registration_listener_1.UserRegistrationListener,
            queue_test_publisher_service_1.TestQueuePublisher,
            queue_test_subscriber_service_1.TestQueueSubscriber,
            mq_message_queue_service_1.MqMessageQueueService,
            mq_message_service_1.MqMessageService,
            permission_metadata_service_1.PermissionMetadataService,
            role_metadata_service_1.RoleMetadataService,
            permission_metadata_seeder_service_1.PermissionMetadataSeederService,
            user_service_1.UserService,
        ],
        exports: [
            module_metadata_service_1.ModuleMetadataService,
            model_metadata_service_1.ModelMetadataService,
            field_metadata_service_1.FieldMetadataService,
            media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService,
            media_service_1.MediaService,
            core_1.DiscoveryService,
            crud_helper_service_1.CrudHelperService,
            platform_express_1.MulterModule,
            file_service_1.FileService,
            solid_registry_1.SolidRegistry,
            SMTPEmailService_1.SMTPEMailService,
            ElasticEmailService_1.ElasticEmailService,
            Msg91SMSService_1.Msg91SMSService,
            Msg91OTPService_1.Msg91OTPService,
            Msg91WhatsappService_1.Msg91WhatsappService,
            tiny_url_service_1.TinyUrlService,
            pdf_service_1.PdfService,
            email_template_service_1.EmailTemplateService,
            sms_template_service_1.SmsTemplateService,
            user_seeder_service_1.UserSeederService,
            authentication_service_1.AuthenticationService,
            mq_message_queue_service_1.MqMessageQueueService,
            mq_message_service_1.MqMessageService,
        ],
    })
], SolidCoreModule);
//# sourceMappingURL=solid-core.module.js.map