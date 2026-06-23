import { Repository } from "typeorm";
import { User } from "src/entities/user.entity";
import { CreateUserDto } from "src/dtos/create-user.dto";
import { CreateEmailTemplateDto } from "src/dtos/create-email-template.dto";
import { CreatePushNotificationTemplateDto } from "src/dtos/create-push-notification-template.dto";
import { CreateSmsTemplateDto } from "src/dtos/create-sms-template.dto";
import { SignUpDto } from "src/dtos/sign-up.dto";
import { Readable } from "stream";
import { CreateMediaStorageProviderMetadataDto } from "./dtos/create-media-storage-provider-metadata.dto";
import { DatasourceType } from "./dtos/create-model-metadata.dto";
import { CreateModuleMetadataDto } from "./dtos/create-module-metadata.dto";
import { CreateRoleMetadataDto } from "./dtos/create-role-metadata.dto";
import { CreateSecurityRuleDto } from "./dtos/create-security-rule.dto";
import { FieldMetadata } from "./entities/field-metadata.entity";
import { Media } from "./entities/media.entity";
import { DashboardQuestion } from "./entities/dashboard-question.entity";
import { ComputedFieldMetadata } from "./helpers/solid-registry";
import { SqlExpression } from "./services/question-data-providers/chartjs-sql-data-provider.service";
import { CreateDashboardDto } from "./dtos/create-dashboard.dto";
import { AiInteraction } from "./entities/ai-interaction.entity";
import { ActiveUserData } from "./interfaces/active-user-data.interface";
import { SecurityRuleConfig } from "./dtos/security-rule-config.dto";
import { SecurityRule } from "./entities/security-rule.entity";
import { PublishCommandOutput } from "@aws-sdk/client-sns";

export interface FieldCrudManager {
  // fieldMetadata: FieldMetadata;
  // entityManager?: EntityManager;
  // createDto: any;
  // files : Array<Express.Multer.File>;
  validate(
    dto: any,
    files: Array<Express.Multer.File>,
  ): ValidationError[] | Promise<ValidationError[]>;
  transformForCreate(dto: any, ctxt?: any): any | Promise<any>;
}

export interface ValidationError {
  field: string;
  error: string;
}

// export interface MediaStorage
export interface MediaStorageProvider<T> {
  store(
    files: Express.Multer.File[],
    entity: T,
    mediaFieldMetadata: FieldMetadata,
  ): Promise<Media[]>;
  delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void>;
  deleteByMediaRecord(media: Media): Promise<void>;
  retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]>;
  storeStreams(
    streamPairs: [Readable, string][],
    entity: T,
    mediaFieldMetadata: FieldMetadata,
  ): Promise<Media[]>;
  // delete(file: string): Promise<void>;
}

export interface ModuleMetadataConfiguration {
  moduleMetadata?: CreateModuleMetadataDto;
  roles?: CreateRoleMetadataDto[];
  users?: SignUpDto[];
  actions?: any[];
  menus?: any[];
  views?: any[];
  emailTemplates?: CreateEmailTemplateDto[];
  smsTemplates?: CreateSmsTemplateDto[];
  pushNotificationTemplates?: CreatePushNotificationTemplateDto[];
  mediaStorageProviders?: CreateMediaStorageProviderMetadataDto[];
  securityRules?: CreateSecurityRuleDto[];
  dashboards?: CreateDashboardDto[];
}

export enum SettingLevel {
  SystemEnv = "system-env",
  SystemAdminReadonly = "system-admin-readonly",
  SystemAdminEditable = "system-admin-editable",
  InternalUser = "internal-user",
}

export type SettingControlType =
  | "shortText"
  | "longText"
  | "numeric"
  | "boolean"
  | "date"
  | "datetime"
  | "mediaSingle"
  | "selectionStatic"
  | "custom";

export interface SettingOption {
  label: string;
  value: string | number | boolean;
}

export interface SettingDefinition<T = any> {
  moduleName: string;
  key: string;
  value: T;
  level: SettingLevel;
  encrypted?: boolean;
  label?: string;
  description?: string;
  placeholder?: string;
  group?: string;
  sortOrder?: number;
  controlType?: SettingControlType;
  options?: SettingOption[];
  settingsWidget?: string; // for custom controlType, specify the frontend widget to use
}

export interface AdminSettingDefinition<T = any> extends SettingDefinition<T> {
  editable: boolean;
}

export interface AdminSettingsResponse<T = any> {
  data: AdminSettingDefinition<T>[];
}

// solid-core/settings/settings-provider.interface.ts
export interface ISettingsProvider {
  getSettings(): SettingDefinition[];
}

export interface CodeGenerationOptions {
  moduleId?: number;
  moduleUserKey?: string;
  modelId?: number;
  modelUserKey?: string;
  fieldIdsForRemoval?: number[];
  fieldNamesForRemoval?: string[];
  dryRun?: boolean;
}

export interface TriggerMcpClientOptions {
  aiInteractionId: number;
  moduleName: string;
}

export interface McpResponse {
  success: boolean;
  request: string;
  response: string;
  model?: string;
  tools_invoked?: string[];
  tool_calls?: any[];
  duration_ms?: number;
  errors?: string[];
  error_trace?: string[];
  content_type?: string;
}

export interface ISelectionProviderContext {
  limit: number;
  offset: number;
  formValues: Record<string, any>;
  //Attribute to control the validation on creating the record
  validateOnSave?: boolean;
  // query: string;
}

export interface ISelectionProviderValues {
  label: string;
  value: string;
}

export interface ISelectionProvider<T extends ISelectionProviderContext> {
  help(): string;

  name(): string;

  value(optionValue: string, ctxt: T): Promise<ISelectionProviderValues | any>;

  values(query: any, ctxt: T): Promise<readonly ISelectionProviderValues[]>;
}

export interface IDashboardVariableSelectionProvider<
  T extends ISelectionProviderContext,
> extends ISelectionProvider<T> {}

export interface IMcpToolResponseHandler {
  apply(aiInteraction: AiInteraction);
}

export interface QuestionSqlDataProviderContext {
  // questionSqlDatasetConfig: QuestionSqlDatasetConfig;
  // questionId: number;
  // question: Question;
  expressions?: SqlExpression[];
}
export interface IDashboardQuestionDataProvider<TContext, TData> {
  help(): string;

  name(): string;

  getData(
    question: DashboardQuestion,
    ctxt?: TContext,
  ): Promise<TData[] | TData>;
}

/**
 * @deprecated Use `IEntityComputedFieldProvider` instead.
 */
export interface IComputedFieldProvider<T> {
  help(): string;

  name(): string;

  valueType(): string;

  computeValue(dto: any, ctxt: T): Promise<string | number>; // FIXME : Improve the types to make it more specific using generics
}

export interface IEntityComputedFieldProvider {
  help(): string;

  name(): string;
}

export interface IEntityPreComputeFieldProvider<
  TTriggerEntity,
  TContext,
  TValue = void,
> extends IEntityComputedFieldProvider {
  preComputeValue(
    triggerEntity: TTriggerEntity,
    computedFieldMetadata: ComputedFieldMetadata<TContext>,
  ): Promise<TValue>;
}

export interface IEntityPostComputeFieldProvider<
  TTriggerEntity,
  TContext,
> extends IEntityComputedFieldProvider {
  postComputeAndSaveValue(
    triggerEntity: TTriggerEntity,
    computedFieldMetadata: ComputedFieldMetadata<TContext>,
  ): Promise<void>;
}

export interface ISolidDatabaseModule {
  name(): string;

  type(): DatasourceType;
}

export enum EventType {
  USER_REGISTERED = "user.registered",
}

export class EventDetails<T> {
  constructor(
    public type: any,
    public payload: T,
  ) {}
}

export interface IExtensionUserCreationProvider<
  T extends User = User,
  TDto extends CreateUserDto = CreateUserDto,
> {
  readonly repo: Repository<T>;
  buildExtensionEntity(dto: TDto): Promise<T>;
  roles(dto: TDto): string[];
}

export interface IMail<TResponse = unknown> {
  sendEmail(
    to: string,
    subject: string,
    body: string,
    shouldQueueEmails: boolean,
    wrapperAttachments?: MailAttachmentWrapper[],
    attachments?: MailAttachment[],
    parentEntity?: any,
    parentEntityId?: any,
    cc?: string[],
    bcc?: string[],
    from?: string,
  ): Promise<TResponse>;

  sendEmailUsingTemplate(
    to: string,
    templateName: string,
    templateParams: any,
    shouldQueueEmails: boolean,
    wrapperAttachments?: MailAttachmentWrapper[],
    attachments?: MailAttachment[],
    parentEntity?: any,
    parentEntityId?: any,
    cc?: string[],
    bcc?: string[],
    from?: string,
  ): Promise<TResponse>;
}

export interface ISMS {
  sendSMS(to: string, body: string, shouldQueueSms: boolean): Promise<any>;

  sendSMSUsingTemplate(
    to: string,
    templateName: string,
    templateParams: any,
    shouldQueueSms: boolean,
  ): Promise<any>;
}

export interface IWhatsAppTransport {
  sendWhatsAppMessage(
    to: string,
    templateId: string,
    parameters: any,
    parentEntity?: any,
    parentEntityId?: any,
  ): Promise<any>;
}

export interface IPushNotification {
  registerDevice(payload: RegisterDevicePayload): Promise<string>;

  unregisterDevice(providerRecipientId: string): Promise<void>;

  sendPushNotification(
    providerRecipientId: string,
    payload: PushNotificationPayload,
    shouldQueue?: boolean,
  ): Promise<unknown>;

  sendPushNotificationUsingTemplate(
    providerRecipientId: string,
    templateName: string,
    templateParams: any,
    shouldQueue?: boolean,
  ): Promise<unknown>;
}

export interface PushNotificationQueuePayload {
  providerRecipientId: string;
  payload: PushNotificationPayload;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface RegisterDevicePayload {
  userId: number;
  deviceId: string;
  deviceToken: string;
  platform: string;
  providerRecipientId?: string;
  deviceName?: string;
  deviceType?: string;
  osName?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface MailAttachmentWrapper {
  relativePath?: string;
  attachment?: MailAttachment;
}

export interface MailAttachment {
  filename: string;
  templatePath?: string; // deprecated
  templateParams?: any; // deprecated
  content?: string | Buffer;
  contentType?: string;
  path?: string; //Filesystem absolute path or URL.
}

export enum BrokerType {
  RabbitMQ = "rabbitmq",
  Database = "database",
  Redis = "redis",
}

export interface QueuesModuleOptions {
  name: string;
  type: BrokerType;
  queueName: string;
  prefetch?: number;
  persistToDatabase?: boolean;
}

export type MediaWithFullUrl = Media & {
  _full_url: string;
};

export type ErrorCode = string;

export type ErrorMeta = {
  message: string;
  httpStatus?: number;
};

export type ErrorRule = {
  /** Canonical error code. Keep them kebab-case for consistency. */
  code: ErrorCode;
  /** Higher runs earlier. Defaults to 0 if not provided. */
  priority?: number;
  /** Return true if this rule matches the combined error text. */
  match: (combinedErrorText: string) => boolean;
  /** Display + HTTP mapping for this code. */
  meta: ErrorMeta;
};

export interface IErrorCodeProvider {
  /** Used for registry identity & logs */
  name(): string;

  /**
   * Return all rules this provider contributes.
   * These will be merged with other providers’ rules, then sorted by priority.
   */
  rules(): ReadonlyArray<ErrorRule>;

  /**
   * Optional fallback meta for codes this provider owns (when called by getMessage/getHttpStatus).
   * If omitted, the ErrorMapperService will rely on the rule.meta of the first matching rule.
   */
  resolve?(code: ErrorCode): ErrorMeta | undefined;
}

// MCP Tool Related

export type PlanStep =
  | CreateNewFileStep
  | RegisterNestProviderStep
  | AddMethodToExistingClassStep
  | RegisterSolidXExtensionComponentStep
  | AddListViewButtonStep
  | AddFormViewButtonStep
  | AddImportStep;
export interface AddImportStep {
  type: "addImport";
  path: string; // e.g. apps/api/src/address-master/services/address-master.service.ts
  importStatement: string; // e.g. import { Something } from 'somewhere';
  overwrite?: boolean; // default=false
  rationale?: string; // optional, ignored by executor
}

export interface CreateNewFileStep {
  type: "createNewFile";
  path: string; // repo-relative e.g. solid-api/api/src/computed-providers/foo.provider.ts
  content: string; // full file content
  overwrite?: boolean; // default=false
  rationale?: string; // optional, ignored by executor
}

export interface RegisterNestProviderStep {
  type: "registerNestProvider";
  modulePath: string; // e.g. apps/api/src/address-master/address-master.module.ts
  providerClassName: string; // e.g. StateTotalCitiesComputedFieldProvider
  importFrom: string; // e.g. "@/computed-providers/state-total-cities.provider"
  registerIn: Array<"providers" | "exports">; // which arrays to add to
  uniqueGuard?: boolean; // default=true
  rationale?: string; // optional, ignored by executor
}

export interface AddMethodToExistingClassStep {
  type: "addMethodToExistingClass";
  path: string; // e.g. apps/api/src/address-master/services/address-master.service.ts
  className: string; // e.g. CountryService
  methodName: string; // e.g. addCountry
  content: string; // Full Method Code
  importStatements?: string[]; // e.g. [ "import { X } from 'y';" ]
  rationale?: string; // optional, ignored by executor
}

export interface RegisterSolidXExtensionComponentStep {
  type: "registerSolidXExtensionComponent";
  path: string; // e.g. apps/api/src/address-master/services/address-master.service.ts
  content?: string; // Code
  importExtensionComponent?: string;
}

export interface AddListViewButtonStep {
  type: "addListViewButton";
  moduleName?: string;
  modelName?: string;
  buttonType?: string;
  content?: string; // Code
}

export interface AddFormViewButtonStep {
  type: "addFormViewButton";
  moduleName?: string;
  modelName?: string;
  buttonType?: string;
  content?: string; // Code
}

export interface McpComputedProviderResponse {
  plan: PlanStep[];
  // provider?: any;  // (intentionally ignored per your note)
}

export interface ISecurityRuleConfigProvider {
  securityRuleConfig(
    activeUser: ActiveUserData,
    securityRule: SecurityRule,
  ): Promise<SecurityRuleConfig>;
}

export interface AwsS3Config {
  S3_AWS_ACCESS_KEY: string;
  S3_AWS_SECRET_KEY: string;
  S3_AWS_REGION_NAME: string;
}

// Prevents inference so callers must provide explicit type arguments; reusable for other APIs.
export type NoInfer<T> = [T][T extends any ? 0 : never];

export type AuditEventType = "insert" | "update" | "delete";

export interface AuditQueuePayload {
  eventType: AuditEventType;
  modelName: string;
  entityId: string | number | null;
  occurredAt: string;
  after?: any;
  before?: any;
  updatedColumnNames?: string[];
  userId?: number | null;
}
