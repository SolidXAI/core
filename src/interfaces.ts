import { CreateEmailTemplateDto } from 'src/dtos/create-email-template.dto';
import { CreateSmsTemplateDto } from 'src/dtos/create-sms-template.dto';
import { SignUpDto } from 'src/dtos/sign-up.dto';
import { CreateActionMetadataDto } from './dtos/create-action-metadata.dto';
import { CreateMediaStorageProviderMetadataDto } from './dtos/create-media-storage-provider-metadata.dto';
import { CreateMenuItemMetadataDto } from './dtos/create-menu-item-metadata.dto';
import { DatasourceType } from './dtos/create-model-metadata.dto';
import { CreateModuleMetadataDto } from './dtos/create-module-metadata.dto';
import { CreateRoleMetadataDto } from './dtos/create-role-metadata.dto';
import { CreateSecurityRuleDto } from './dtos/create-security-rule.dto';
import { CreateViewMetadataDto } from './dtos/create-view-metadata.dto';
import { FieldMetadata } from './entities/field-metadata.entity';
import { Media } from './entities/media.entity';
import { Readable } from 'stream';

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
    actions?: CreateActionMetadataDto[],
    menus?: CreateMenuItemMetadataDto[],
    views?: CreateViewMetadataDto[],
    emailTemplates?: CreateEmailTemplateDto[],
    smsTemplates?: CreateSmsTemplateDto[],
    mediaStorageProviders?: CreateMediaStorageProviderMetadataDto[]
    securityRules?: CreateSecurityRuleDto[],
}

export interface CodeGenerationOptions {
    moduleId?: number;
    moduleUserKey?: string;
    modelId?: number;
    modelUserKey?: string;
    fieldIdsForRemoval?: number[];
    dryRun?: boolean;
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

export interface IComputedFieldProvider<T> {
  help(): string;

  name(): string;

  valueType(): string;

  computeValue(dto: any, ctxt: T): Promise<string | number>; // FIXME : Improve the types to make it more specific using generics
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
  ) {}
}

export interface IMail {
  sendEmail(
    to: string,
    subject: string,
    body: string,
    shouldQueueEmails: boolean,
    wrapperAttachments?: MailAttachmentWrapper[],
    attachments?: MailAttachment[],
    parentEntity?: any,
    parentEntityId?: any,
  ): Promise<void>;

  sendEmailUsingTemplate(
    to: string,
    templateName: string,
    templateParams: any,
    shouldQueueEmails: boolean,
    wrapperAttachments?: MailAttachmentWrapper[],
    attachments?: MailAttachment[],
    parentEntity?: any,
    parentEntityId?: any,
  ): Promise<void>;
}

export interface ISMS {
  sendSMS(to: string, body: string, shouldQueueSms: boolean): Promise<void>;

  sendSMSUsingTemplate(
    to: string,
    templateName: string,
    templateParams: any,
    shouldQueueSms: boolean,
  ): Promise<void>;
}

export interface MailAttachmentWrapper {
  relativePath?: string;
  attachment?: MailAttachment;
}

export interface MailAttachment {
  filename: string;
  templatePath?: string;
  templateParams?: any;
  content?: string | Buffer;
  contentType?: string;
  path?: string;
}

export enum BrokerType {
  RabbitMQ = 'rabbitmq',
}

export interface QueuesModuleOptions {
  name: string;
  type: BrokerType;
  queueName: string;
}

export type MediaWithFullUrl = Media & {
  _full_url: string;
};
