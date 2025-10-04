import { CreateEmailTemplateDto } from 'src/dtos/create-email-template.dto';
import { CreateSmsTemplateDto } from 'src/dtos/create-sms-template.dto';
import { SignUpDto } from 'src/dtos/sign-up.dto';
import { Readable } from 'stream';
import { CreateMediaStorageProviderMetadataDto } from './dtos/create-media-storage-provider-metadata.dto';
import { DatasourceType } from './dtos/create-model-metadata.dto';
import { CreateModuleMetadataDto } from './dtos/create-module-metadata.dto';
import { CreateRoleMetadataDto } from './dtos/create-role-metadata.dto';
import { CreateSecurityRuleDto } from './dtos/create-security-rule.dto';
import { FieldMetadata } from './entities/field-metadata.entity';
import { Media } from './entities/media.entity';
import { DashboardQuestion } from './entities/dashboard-question.entity';
import { ComputedFieldMetadata } from './helpers/solid-registry';
import { SqlExpression } from './services/question-data-providers/chartjs-sql-data-provider.service';
import { CreateDashboardDto } from './dtos/create-dashboard.dto';
import { AiInteraction } from './entities/ai-interaction.entity';

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
  store(files: Express.Multer.File[], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]>;
  delete(entity: T, mediaFieldMetadata: FieldMetadata): Promise<void>;
  retrieve(entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]>;
  storeStreams(streamPairs: [Readable, string][], entity: T, mediaFieldMetadata: FieldMetadata): Promise<Media[]>;
  // delete(file: string): Promise<void>;
}

export interface ModuleMetadataConfiguration {
  moduleMetadata?: CreateModuleMetadataDto,
  roles?: CreateRoleMetadataDto[],
  users?: SignUpDto[],
  actions?: any[],
  menus?: any[],
  views?: any[],
  emailTemplates?: CreateEmailTemplateDto[],
  smsTemplates?: CreateSmsTemplateDto[],
  mediaStorageProviders?: CreateMediaStorageProviderMetadataDto[]
  securityRules?: CreateSecurityRuleDto[],
  dashboards?: CreateDashboardDto[],
}

export interface CodeGenerationOptions {
  moduleId?: number;
  moduleUserKey?: string;
  modelId?: number;
  modelUserKey?: string;
  fieldIdsForRemoval?: number[];
  dryRun?: boolean;
}

export interface TriggerMcpClientOptions {
  aiInteractionId: number;
  moduleName:string;
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

export interface IDashboardVariableSelectionProvider<T extends ISelectionProviderContext> extends ISelectionProvider<T> {
}

export interface IMcpToolResponseHandler {
  apply(aiInteraction: AiInteraction);
}

export interface IDashboardQuestionDataProvider<TContext, TData> {
  help(): string;

  name(): string;

  getData(question: DashboardQuestion, expressions?: SqlExpression[], ctxt?: TContext): Promise<TData[] | TData>;
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

export interface IEntityPreComputeFieldProvider<TTriggerEntity, TContext, TValue = void> extends IEntityComputedFieldProvider {
  preComputeValue(triggerEntity: TTriggerEntity, computedFieldMetadata: ComputedFieldMetadata<TContext>): Promise<TValue>;
}

export interface IEntityPostComputeFieldProvider<TTriggerEntity, TContext> extends IEntityComputedFieldProvider {
  postComputeAndSaveValue(triggerEntity: TTriggerEntity, computedFieldMetadata: ComputedFieldMetadata<TContext>): Promise<void>;
}

export interface ISolidDatabaseModule {
  name(): string;

  type(): DatasourceType;
}

export enum EventType {
  USER_REGISTERED = 'user.registered',
}

export class EventDetails<T> {
  constructor(
    public type: any,
    public payload: T,
  ) { }
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
    parentEntityId?: any
  ): Promise<any>;
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
  RabbitMQ = 'rabbitmq',
  Database = 'database'
}

export interface QueuesModuleOptions {
  name: string;
  type: BrokerType;
  queueName: string;
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