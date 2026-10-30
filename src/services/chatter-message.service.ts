import { LocalDateTimeTransformer, serializeDate } from 'src/transformers/typeorm/local-date-time-transformer';
import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { Brackets, EntityManager, EntityMetadata, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ClsService } from 'nestjs-cls';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

import { classify } from '@angular-devkit/core/src/utils/strings';
import { CHATTER_MESSAGE_STATUS, CHATTER_MESSAGE_SUBTYPE, CHATTER_MESSAGE_TYPE, CHATTER_MESSAGE_USER_FIELDS } from 'src/constants/chatter-message.constants';
import { isDangerousMediaFile } from 'src/constants/media-file-types';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { MediaFieldCrudManager, SolidMediaType } from 'src/helpers/field-crud-managers/MediaFieldCrudManager';
import { PostChatterMessageDto } from 'src/dtos/post-chatter-message.dto';
import { UpdateChatterNoteMessageDto } from 'src/dtos/update-chatter-note-message.dto';
import { ImportChatterFromOdooDto } from 'src/dtos/import-chatter-from-odoo.dto';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { lowerFirst } from 'src/helpers/string.helper';
import { sanitizeStoredMediaFileName } from 'src/services/media-storage.utils';
import { ChatterMentionNotificationPayload } from 'src/interfaces/chatter-mention-notification.interface';
import { OdooChatterImportQueuePayload } from 'src/jobs/rabbitmq/odoo-chatter-import-queue-options';
import { ChatterMessageDetailsRepository } from 'src/repository/chatter-message-details.repository';
import { ChatterMessageRepository } from 'src/repository/chatter-message.repository';
import { FieldMetadataRepository } from 'src/repository/field-metadata.repository';
import { MediaRepository } from 'src/repository/media.repository';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { CRUDService } from 'src/services/crud.service';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { MediaStorageProviderType } from '../dtos/create-media-storage-provider-metadata.dto';
import { ChatterMessageDetails } from '../entities/chatter-message-details.entity';
import { ChatterMessage } from '../entities/chatter-message.entity';
import { User } from '../entities/user.entity';
import { getMediaStorageProvider } from './mediaStorageProviders';
import { RequestContextService } from './request-context.service';
import { Logger } from '@nestjs/common';
import { SolidIntrospectService } from './solid-introspect.service';
import { PublisherFactory } from './queues/publisher-factory.service';

/** Shape of a Odoo `mail.message` row, as returned by `search_read` - see ODOO_CHATTER_IMPORT_PLAN.md */
interface OdooMessage {
    id: number;
    res_id: number;
    date: string;
    author_id?: [number, string];
    body?: string;
    tracking_value_ids?: number[];
    attachment_ids?: number[];
}

interface OdooAttachmentStream {
    stream: Readable;
    mimeType: string;
    originalFileName: string;
}

interface ChatterMention {
    username: string;
    display_name?: string;
    displayName?: string;
    id?: string | number;
}

/**
 * Server-side-only overrides for `postMessage`. Not part of `PostChatterMessageDto`, so
 * nothing here is settable over HTTP - only in-process callers such as migration or
 * back-fill services can supply it.
 */
export interface PostChatterMessageOptions {
    /** Backdate the message instead of stamping it with the current time. */
    createdAt?: Date;
}

@Injectable()
export class ChatterMessageService extends CRUDService<ChatterMessage> {
    private readonly _logger = new Logger(ChatterMessageService.name);

    constructor(
        @InjectEntityManager()
        readonly entityManager: EntityManager,
        // @InjectRepository(ChatterMessage, 'default')
        readonly repo: ChatterMessageRepository,
        // @InjectRepository(ChatterMessageDetailsRepository, 'default')
        readonly chatterMessageDetailsRepo: ChatterMessageDetailsRepository,
        readonly mediaRepository: MediaRepository,
        // @InjectRepository(FieldMetadata, 'default')
        // readonly fieldMetadataRepo: Repository<FieldMetadata>,
        readonly fieldMetadataRepo: FieldMetadataRepository,
        readonly moduleRef: ModuleRef,
        // @InjectRepository(ModelMetadata)
        // private readonly modelMetadataRepo: Repository<ModelMetadata>,
        @Inject(forwardRef(() => ModelMetadataRepository))
        private readonly modelMetadataRepo: ModelMetadataRepository,
        readonly requestContextService: RequestContextService,
        private readonly modelMetadataHelperService: ModelMetadataHelperService,
        private readonly publisherFactory: PublisherFactory<ChatterMentionNotificationPayload>,
        private readonly httpService: HttpService,
        private readonly clsService: ClsService,
    ) {
        super(entityManager, repo, 'chatterMessage', 'solid-core', moduleRef);
    }

    private getCoModelService(coModelName: string): CRUDService<any> {
        const introspectService = this.moduleRef.get(SolidIntrospectService, { strict: false });
        const modelSingularName = lowerFirst(coModelName);
        const coModelService = introspectService?.getCRUDService(modelSingularName);
        if (!coModelService) {
            throw new BadRequestException(ERROR_MESSAGES.MODEL_SERVICE_NOT_FOUND(modelSingularName));
        }
        return coModelService;
    }

    private async assertRecordAccess(coModelName: string, coModelEntityId: number) {
        const activeUser = this.requestContextService.getActiveUser();
        if (!activeUser) {
            throw new ForbiddenException(ERROR_MESSAGES.FORBIDDEN);
        }

        const coModelService = this.getCoModelService(coModelName);
        await coModelService.findOne(coModelEntityId, {}, { activeUser });
    }

    private resolveMessageUserId(userId?: number | null): number | null {
        if (userId) {
            return userId;
        }

        return this.requestContextService.getActiveUser()?.sub ?? null;
    }

    private resolveMessageUser(userId?: number | null) {
        const resolvedUserId = this.resolveMessageUserId(userId);
        return resolvedUserId ? ({ id: resolvedUserId } as any) : null;
    }

    private stampMessageAuditFields(chatterMessage: ChatterMessage, userId?: number | null) {
        const resolvedUserId = this.resolveMessageUserId(userId);
        chatterMessage.user = resolvedUserId ? ({ id: resolvedUserId } as any) : null;
        chatterMessage.createdBy = resolvedUserId;
        chatterMessage.updatedBy = resolvedUserId;
    }

    /**
     * Reduce a message's hydrated `user` relation to CHATTER_MESSAGE_USER_FIELDS.
     *
     * `getChatterMessages` restricts the columns in the query itself, which is preferable.
     * The generic CRUD paths below build their query from find-options and hand `populate`
     * straight to TypeORM, so they are trimmed after the fact instead. (`createdBy` /
     * `updatedBy` need nothing here - CRUDService.handlePopulateUserIdFields already selects
     * only USER_SUMMARY_FIELDS when a caller populates them.)
     */
    private trimMessageUser<M extends ChatterMessage>(message: M): M {
        if (message?.user) {
            message.user = this.toUserSummary(message.user) as User;
        }
        return message;
    }

    private trimMessageUsers(messages: ChatterMessage[] | undefined) {
        messages?.forEach(message => this.trimMessageUser(message));
    }

    /**
     * `GET /chatter-message?populate[]=user` would otherwise be a way around the column
     * allowlist applied by getChatterMessages.
     */
    async find(basicFilterDto: BasicFilterDto, solidRequestContext: any = {}): Promise<any> {
        const result = await super.find(basicFilterDto, solidRequestContext);
        this.trimMessageUsers(result?.records);
        // A grouped find (populateGroup) nests its entities one level deeper.
        for (const groupRecord of result?.groupRecords ?? []) {
            this.trimMessageUsers(groupRecord?.groupData?.records);
        }
        return result;
    }

    async findOne(id: number, query: any = {}, solidRequestContext: any = {}) {
        return this.trimMessageUser(await super.findOne(id, query, solidRequestContext));
    }

    private isEditableCustomNoteMessage(message: ChatterMessage): boolean {
        if (message.messageType !== CHATTER_MESSAGE_TYPE.CUSTOM) {
            return false;
        }
        return [CHATTER_MESSAGE_SUBTYPE.CUSTOM, CHATTER_MESSAGE_SUBTYPE.NOTE].includes(message.messageSubType as any);
    }

    private parseAttachmentIds(value?: string): number[] {
        if (!value || typeof value !== 'string') return [];
        return value
            .split(',')
            .map(v => Number(v.trim()))
            .filter(v => Number.isInteger(v) && v > 0);
    }

    private parseMessageBodyMentions(value?: string): ChatterMention[] {
        if (!value || typeof value !== 'string') return [];
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    private renderMentionTokens(messageBody: string, mentions: ChatterMention[]) {
        return mentions.reduce((nextMessage, mention, index) => {
            const username = mention.username;
            if (!username) return nextMessage;
            return nextMessage.replace(new RegExp(`\\{\\{\\s*${index}\\s*\\}\\}`, 'g'), `@${username}`);
        }, messageBody || '');
    }

    /**
     * Chatter attachments bypass MediaFieldCrudManager - they go straight to
     * storageProvider.store() - so the shared predicate is applied here directly. The rules
     * themselves live in media-file-types so upload paths can't drift apart.
     */
    private validateChatterMediaFiles(files: Express.Multer.File[] = []) {
        if (Array.isArray(files) && files.some(file => isDangerousMediaFile(file))) {
            throw new BadRequestException('Dangerous file types are not allowed in chatter attachments.');
        }
    }

    /**
     * Validates newly-uploaded attachments against each declared media field's real config
     * (mediaTypes/mediaMaxSizeKb/mediaAllowedExtensions), grouped by fieldname - the same rules
     * MediaFieldCrudManager already enforces everywhere else. Shared between postMessage and
     * updateCustomNoteMessage so the two entry points can't drift apart; isUpdate is the only
     * thing that differs between them.
     */
    private validateChatterAttachmentsForFields(files: Express.Multer.File[], mediaFields: any[], isUpdate: boolean): void {
        for (const mediaField of mediaFields) {
            const media = files.filter(multerFile => multerFile.fieldname === mediaField.name);
            if (media.length === 0) continue;

            const validator = new MediaFieldCrudManager({
                type: mediaField.type as SolidMediaType,
                required: mediaField.required,
                fieldName: mediaField.name,
                mediaMaxSizeKb: mediaField.mediaMaxSizeKb,
                mediaTypes: mediaField.mediaTypes,
                mediaAllowedExtensions: mediaField.mediaAllowedExtensions,
                isUpdate,
            });
            const validationErrors = validator.validate({}, media);
            if (validationErrors.length > 0) {
                throw new BadRequestException(validationErrors.map(error => error.error).join(', '));
            }
        }
    }

    private async publishChatterMentionNotifications(message: ChatterMessage, model: any) {
        if (message.messageType !== CHATTER_MESSAGE_TYPE.CUSTOM || message.messageSubType !== CHATTER_MESSAGE_SUBTYPE.NOTE) {
            return;
        }

        const mentions = this.parseMessageBodyMentions(message.messageBodyMentions);
        const mentionUserIds = mentions
            .map(mention => Number(mention.id))
            .filter(id => Number.isInteger(id) && id > 0);
        const uniqueMentionUserIds = Array.from(new Set(mentionUserIds));
        if (uniqueMentionUserIds.length === 0) return;

        const activeUser = this.requestContextService.getActiveUser();

        const payload: ChatterMentionNotificationPayload = {
            templateName: 'chatter-mention-notification',
            mentions: mentions.map(mention => ({
                id: Number(mention.id) || undefined,
                username: mention.username,
                displayName: mention.display_name || mention.displayName || mention.username,
            })),
            actor: {
                id: activeUser?.sub,
                username: activeUser?.username,
                email: activeUser?.email,
            },
            noteBody: this.renderMentionTokens(message.messageBody, mentions),
            entity: {
                id: message.coModelEntityId,
                modelName: model?.singularName || message.coModelName,
                moduleName: model?.module?.name,
                displayName: model?.displayName || message.coModelName,
                userKey: message.modelUserKey,
            },
            parentEntity: 'chatterMessage',
            parentEntityId: message.id,
        };

        try {
            await this.publisherFactory.publish(
                {
                    payload,
                    parentEntity: 'chatterMessage',
                    parentEntityId: message.id,
                    retryCount: 3,
                    retryInterval: 5000,
                },
                'ChatterMentionNotificationEmailQueuePublisher',
            );
        } catch (error: any) {
            this._logger.error(`Failed to publish chatter mention notification email job: ${error.message}`, error.stack);
        }
    }

    // Deliberately bypasses UserRepository's security-rule filtering: the mention picker
    // needs id/username/fullName for any active user regardless of the caller's row-level
    // access to the User model, same as the getChatterMessages one-to-many lookup below.
    async getMentionableUsers(search?: string, limit: number = 8): Promise<Array<{ id: number; username: string; fullName: string }>> {
        const normalizedLimit = Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : 8;
        const userRepository = this.entityManager.getRepository(User);

        const qb = userRepository
            .createQueryBuilder('user')
            .select(['user.id', 'user.username', 'user.fullName'])
            .where('user.active = :active', { active: true });

        const trimmedSearch = (search ?? '').trim();
        if (trimmedSearch) {
            qb.andWhere('(LOWER(user.username) LIKE :search OR LOWER(user.fullName) LIKE :search)', {
                search: `%${trimmedSearch.toLowerCase()}%`,
            });
        }

        qb.orderBy('user.username', 'ASC').take(normalizedLimit);

        const users = await qb.getMany();
        return users.map(user => ({ id: user.id, username: user.username, fullName: user.fullName }));
    }

    async markCompleted(id: number) {
        const activeUser = this.requestContextService.getActiveUser();
        if (!activeUser) {
            throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
        }

        const message = await this.repo.findOne({ where: { id } });
        if (!message) {
            throw new NotFoundException(`Entity [solid-core.chatterMessage] with id ${id} not found`);
        }

        await this.assertRecordAccess(message.coModelName, message.coModelEntityId);

        message.status = CHATTER_MESSAGE_STATUS.COMPLETED;
        return this.repo.save(message);
    }

    async updateCustomNoteMessage(id: number, updateDto: UpdateChatterNoteMessageDto, files: Express.Multer.File[] = []) {
        const activeUser = this.requestContextService.getActiveUser();
        if (!activeUser) {
            throw new ForbiddenException(ERROR_MESSAGES.FORBIDDEN);
        }

        const message = await this.repo.findOne({ where: { id }, relations: { user: true } });
        if (!message) {
            throw new NotFoundException(`Entity [solid-core.chatterMessage] with id ${id} not found`);
        }

        await this.assertRecordAccess(message.coModelName, message.coModelEntityId);

        if (!this.isEditableCustomNoteMessage(message)) {
            throw new BadRequestException('Only custom note messages can be edited.');
        }

        if (!message.user?.id || message.user.id !== activeUser.sub) {
            throw new ForbiddenException('You can only edit your own custom note messages.');
        }

        const removeAttachmentIds = this.parseAttachmentIds(updateDto?.removeAttachmentIds);
        const hasMessageBody = typeof updateDto?.messageBody === 'string';
        const hasMessageBodyMentions = typeof updateDto?.messageBodyMentions === 'string';
        const trimmedMessageBody = (updateDto?.messageBody ?? '').trim();
        const hasNewFiles = Array.isArray(files) && files.length > 0;

        if (!hasMessageBody && !hasMessageBodyMentions && removeAttachmentIds.length === 0 && !hasNewFiles) {
            throw new BadRequestException('No note changes submitted.');
        }

        if (hasMessageBody && trimmedMessageBody.length === 0) {
            throw new BadRequestException('Message body cannot be empty.');
        }

        this.validateChatterMediaFiles(files);

        let chatterModel: any = null;
        let mediaFields: any[] = [];
        if (removeAttachmentIds.length > 0 || hasNewFiles) {
            chatterModel = await this.modelMetadataService.findOneBySingularName('chatterMessage', {
                fields: {
                    model: true,
                    mediaStorageProvider: true,
                },
                module: true,
            });

            mediaFields = chatterModel.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple');

            if (hasNewFiles) {
                this.validateChatterAttachmentsForFields(files, mediaFields, true);
            }
        }

        if (hasMessageBody) {
            message.messageBody = trimmedMessageBody;
        }
        if (hasMessageBodyMentions) {
            message.messageBodyMentions = updateDto.messageBodyMentions;
        }
        const model = await this.modelMetadataRepo.findOne({
            where: { singularName: message.coModelName },
            relations: { module: true }
        });
        message.updatedBy = activeUser.sub;
        // Ensure updatedAt changes even for attachment-only edits.
        message.updatedAt = new Date();
        const savedMessage = await this.repo.save(message);

        if (removeAttachmentIds.length > 0 || hasNewFiles) {
            const attachmentFieldIds = mediaFields.map(field => field.id);

            if (removeAttachmentIds.length > 0 && attachmentFieldIds.length > 0) {
                const mediaToRemove = await this.mediaRepository.find({
                    where: {
                        id: In(removeAttachmentIds),
                        entityId: savedMessage.id,
                        modelMetadata: { id: chatterModel.id },
                        fieldMetadata: { id: In(attachmentFieldIds) },
                    },
                    relations: {
                        mediaStorageProviderMetadata: true,
                        fieldMetadata: true,
                    },
                });

                for (const media of mediaToRemove) {
                    const storageType = media.mediaStorageProviderMetadata?.type as MediaStorageProviderType;
                    const storageProvider = await getMediaStorageProvider(this.moduleRef, storageType);
                    await storageProvider.deleteByMediaRecord(media);
                }

                if (mediaToRemove.length > 0) {
                    await this.mediaRepository.remove(mediaToRemove);
                }
            }

            for (const mediaField of mediaFields) {
                const storageProviderMetadata = mediaField.mediaStorageProvider;
                const storageProviderType = storageProviderMetadata.type as MediaStorageProviderType;
                const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);

                const media = files.filter(multerFile => multerFile.fieldname === mediaField.name);
                if (media.length > 0) {
                    await storageProvider.store(media, savedMessage, mediaField);
                }
            }
        }

        await this.publishChatterMentionNotifications(savedMessage, model);

        // The `user` relation was loaded for the ownership check above; don't return all of it.
        return this.trimMessageUser(savedMessage);
    }

    /**
     * Post a chatter message.
     *
     * `options` is deliberately kept out of `PostChatterMessageDto` so it can only be supplied
     * by server-side callers (migrations, back-fills). The controller binds the DTO alone, so
     * an API client has no way to backdate a message.
     */
    async postMessage(postDto: PostChatterMessageDto, files: Express.Multer.File[] = [], options: PostChatterMessageOptions = {}) {
        const coModelName = lowerFirst(postDto.coModelName);
        await this.assertRecordAccess(coModelName, postDto.coModelEntityId);

        this.validateChatterMediaFiles(files);

        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.CUSTOM;
        chatterMessage.messageSubType = postDto.messageSubType || CHATTER_MESSAGE_SUBTYPE.CUSTOM;
        chatterMessage.status = postDto.status ?? CHATTER_MESSAGE_STATUS.PENDING;
        chatterMessage.messageBody = postDto.messageBody;
        chatterMessage.messageBodyMentions = postDto.messageBodyMentions;
        chatterMessage.coModelEntityId = postDto.coModelEntityId;
        chatterMessage.coModelName = coModelName;
        chatterMessage.modelUserKey = this.toUserKeyString(postDto.modelUserKey);
        // Left unset otherwise, so the @CreateDateColumn default still applies.
        if (options.createdAt) {
            chatterMessage.createdAt = options.createdAt;
        }

        const model = await this.modelMetadataRepo.findOne({
            where: { singularName: coModelName },
            relations: { userKeyField: true, module: true }
        });
        chatterMessage.modelDisplayName = model?.displayName ?? null;

        this.stampMessageAuditFields(chatterMessage);

        let mediaFields: any[] = [];
        if (files && files.length > 0) {
            const chatterModel = await this.modelMetadataService.findOneBySingularName('chatterMessage', {
                fields: {
                    model: true,
                    mediaStorageProvider: true,
                },
                module: true,
            });

            mediaFields = chatterModel.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple');
            this.validateChatterAttachmentsForFields(files, mediaFields, false);
        }

        const savedMessage = await this.repo.save(chatterMessage);

        if (files && files.length > 0) {
            for (const mediaField of mediaFields) {
                const media = files.filter(multerFile => multerFile.fieldname === mediaField.name);
                if (media.length > 0) {
                    const storageProviderMetadata = mediaField.mediaStorageProvider;
                    const storageProviderType = storageProviderMetadata.type as MediaStorageProviderType;
                    const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);
                    await storageProvider.store(media, savedMessage, mediaField);
                }
            }
        }

        await this.publishChatterMentionNotifications(savedMessage, model);

        return savedMessage;
    }

    // ---------------------------------------------------------------------------------------
    // Import chatter history from Odoo - see ODOO_CHATTER_IMPORT_PLAN.md for the full design.
    // ---------------------------------------------------------------------------------------

    private odooRpcUrl(baseUrl: string, path: string): string {
        return `${baseUrl.replace(/\/+$/, '')}${path}`;
    }

    /**
     * Logs into Odoo once and returns the `session_id` cookie. The password is used here,
     * synchronously, and never travels any further - only this cookie goes into the queue
     * payload, so a leaked queue message exposes a revocable 7-day session, not the admin
     * password itself.
     */
    private async odooAuthenticate(baseUrl: string, db: string, login: string, password: string): Promise<string> {
        const response = await this.httpService.axiosRef.post(
            this.odooRpcUrl(baseUrl, '/web/session/authenticate'),
            { jsonrpc: '2.0', method: 'call', params: { db, login, password } },
            { headers: { 'Content-Type': 'application/json' } },
        );

        if (response.data?.error) {
            throw new BadRequestException(`Odoo authentication failed: ${response.data.error.data?.message || response.data.error.message}`);
        }

        const setCookieHeaders: string[] = response.headers?.['set-cookie'] ?? [];
        const sessionCookie = setCookieHeaders
            .map(cookie => cookie.split(';')[0])
            .find(cookie => cookie.startsWith('session_id='));

        if (!sessionCookie) {
            throw new BadRequestException('Odoo authentication succeeded but returned no session cookie');
        }

        return sessionCookie;
    }

    /** Generic Odoo JSON-RPC read, e.g. `odooCallKw(base, cookie, 'mail.message', 'search_read', [domain, fields], { limit, order })`. */
    private async odooCallKw<T = any>(
        baseUrl: string,
        sessionCookie: string,
        model: string,
        method: string,
        args: any[],
        kwargs: Record<string, any> = {},
    ): Promise<T> {
        const response = await this.httpService.axiosRef.post(
            this.odooRpcUrl(baseUrl, '/web/dataset/call_kw'),
            { jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs } },
            { headers: { 'Content-Type': 'application/json', Cookie: sessionCookie } },
        );

        if (response.data?.error) {
            throw new BadRequestException(`Odoo ${model}.${method} failed: ${response.data.error.data?.message || response.data.error.message}`);
        }

        return response.data.result;
    }

    /** Downloads one Odoo attachment via the standard `/web/content/{id}?download=true` convention. */
    private async odooFetchAttachment(baseUrl: string, sessionCookie: string, attachmentId: number): Promise<OdooAttachmentStream> {
        const response = await this.httpService.axiosRef.get(
            this.odooRpcUrl(baseUrl, `/web/content/${attachmentId}?download=true`),
            { headers: { Cookie: sessionCookie }, responseType: 'stream' },
        );

        const disposition: string = response.headers?.['content-disposition'] ?? '';
        const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);

        return {
            stream: response.data,
            mimeType: response.headers?.['content-type'] || 'application/octet-stream',
            originalFileName: fileNameMatch?.[1] || `odoo-attachment-${attachmentId}`,
        };
    }

    /**
     * Odoo's `mail.tracking.value.field_id` display name is always suffixed with the owning
     * model's display name, e.g. "Designation (Employees)" - strip that trailing "(...)" since
     * it's redundant noise in a table that's already scoped to one record.
     */
    private stripOdooModelSuffix(label: string): string {
        return (label || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || label;
    }

    private escapeHtml(value: any): string {
        if (value === null || value === undefined || value === false || value === '') {
            return '—';
        }
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /** Minimal safety pass over Odoo's own message HTML - strips script tags / inline event handlers, keeps everything else (links, styling) intact. */
    private sanitizeOdooBodyHtml(html: string): string {
        if (!html) {
            return '';
        }
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
            .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
    }

    /** One of `old_value_char|integer|float|text|datetime` is populated on a `mail.tracking.value`, depending on the field's type. */
    private extractOdooTrackingValue(trackingValue: any, prefix: 'old' | 'new'): any {
        for (const key of ['char', 'integer', 'float', 'text', 'datetime']) {
            const value = trackingValue[`${prefix}_value_${key}`];
            if (value !== false && value !== null && value !== undefined && value !== '') {
                return value;
            }
        }
        return null;
    }

    private formatOdooDate(odooDate: string): Date {
        // Odoo returns naive UTC timestamps as "YYYY-MM-DD HH:mm:ss".
        return new Date(`${odooDate.replace(' ', 'T')}Z`);
    }

    private buildOdooMessageHtml(message: OdooMessage, trackingValues: any[]): string {
        const hasTracking = trackingValues && trackingValues.length > 0;
        const authorName = this.escapeHtml(message.author_id?.[1] || 'Unknown Odoo user');
        const when = message.date ? this.formatOdooDate(message.date).toLocaleString() : '';

        const parts: string[] = ['<div class="odoo-import-log">'];
        parts.push(
            `<div class="odoo-import-log__meta"><strong>Imported from Odoo</strong> — ` +
            `${hasTracking ? 'Changed' : 'Posted'} by <strong>${authorName}</strong>` +
            `${when ? ` on <strong>${this.escapeHtml(when)}</strong>` : ''}</div>`,
        );

        if (hasTracking) {
            const rows = trackingValues.map(trackingValue => {
                const label = this.escapeHtml(this.stripOdooModelSuffix(trackingValue.field_id?.[1] || trackingValue.display_name || 'Field'));
                const oldValue = this.escapeHtml(this.extractOdooTrackingValue(trackingValue, 'old'));
                const newValue = this.escapeHtml(this.extractOdooTrackingValue(trackingValue, 'new'));
                return `<tr><td>${label}</td><td>${oldValue}</td><td>${newValue}</td></tr>`;
            }).join('');
            parts.push(
                `<table class="odoo-import-log__table" border="1" cellpadding="4" cellspacing="0">` +
                `<thead><tr><th>Field</th><th>Previous Value</th><th>Changed Value</th></tr></thead>` +
                `<tbody>${rows}</tbody></table>`,
            );
        }

        if (message.body && message.body.trim()) {
            parts.push(`<div class="odoo-import-log__note">${this.sanitizeOdooBodyHtml(message.body)}</div>`);
        }

        parts.push('</div>');
        return parts.join('');
    }

    /**
     * Fixed system user id attributed as `createdBy`/`updatedBy` on every imported message
     * (the real Odoo author is rendered as text inside the HTML instead - see buildOdooMessageHtml -
     * since that Odoo user will usually not exist as a SolidX `User`). Override via
     * ODOO_IMPORT_SYSTEM_USER_ID if user id 1 isn't the right system/admin account to attribute to.
     */
    private getOdooImportSystemUserId(): number {
        const envUserId = Number(process.env.ODOO_IMPORT_SYSTEM_USER_ID);
        return Number.isInteger(envUserId) && envUserId > 0 ? envUserId : 1;
    }

    /**
     * `POST /chatter-message/importFromOdoo` - authenticates against Odoo once (synchronously,
     * so the password never travels through the queue), then hands off the actual import to a
     * RabbitMQ job so the HTTP caller isn't blocked on it.
     */
    async importFromOdoo(dto: ImportChatterFromOdooDto) {
        const odooSessionCookie = await this.odooAuthenticate(dto.odooBaseUrl, dto.odooDb, dto.odooLogin, dto.odooPassword);

        const payload: OdooChatterImportQueuePayload = {
            odooModelName: dto.odooModelName,
            odooBaseUrl: dto.odooBaseUrl,
            odooSessionCookie,
            solidxModelName: lowerFirst(dto.solidxModelName),
            odooId: dto.odooId,
            fromDate: dto.fromDate,
            batchSize: dto.batchSize ?? 100,
        };

        // `publisherFactory` is injected as `PublisherFactory<ChatterMentionNotificationPayload>`
        // above, but NestJS resolves it by class token regardless of the generic parameter (TS
        // generics don't exist at runtime) - it's the same singleton either way, so this cast is
        // safe rather than adding a second constructor dependency for the same provider.
        await this.publisherFactory.publish({ payload } as any, 'OdooChatterImportQueuePublisher');

        return { message: 'Odoo chatter import started' };
    }

    /**
     * Fetches one page of SolidX `coModelName` records to import chatter for - either the single
     * record matching `odooId` (throws if it doesn't exist - an explicit single-record request
     * should fail loudly) or a page of every record with a non-null `odooId`.
     */
    private async fetchSolidxRecordsToImport(
        coModelName: string,
        odooId: number | undefined,
        offset: number,
        limit: number,
    ): Promise<{ id: number; odooId: number }[]> {
        const coModelService = this.getCoModelService(coModelName);

        if (odooId !== undefined && odooId !== null) {
            if (offset > 0) {
                return []; // single-record mode - nothing more after the first page.
            }
            const result = await coModelService.find({ limit: 1, offset: 0, filters: { odooId: { $eq: odooId } } } as any);
            const record = result?.records?.[0];
            if (!record) {
                throw new BadRequestException(`No SolidX "${coModelName}" record found with odooId=${odooId}`);
            }
            return [record];
        }

        const result = await coModelService.find({ limit, offset, filters: { odooId: { $notNull: true } } } as any);
        return result?.records ?? [];
    }

    /**
     * The actual worker, invoked from `OdooChatterImportQueueSubscriberRabbitmq`. Runs entirely
     * outside an HTTP request, but `CRUDService.find()` (called by `fetchSolidxRecordsToImport`)
     * unconditionally calls `RequestContextService.setRequestFilter()` -> `ClsService#set`, which
     * throws ("No CLS context available") unless a CLS context has been established first -
     * normally done by a request-scoped middleware/guard, which obviously never runs for a queue
     * job. `clsService.run()` establishes that context manually for the duration of this call.
     */
    async runOdooChatterImport(payload: OdooChatterImportQueuePayload) {
        return this.clsService.run(() => this.runOdooChatterImportInner(payload));
    }

    private async runOdooChatterImportInner(payload: OdooChatterImportQueuePayload) {
        const batchSize = payload.batchSize || 100;

        let messagesImported = 0;
        let messagesSkipped = 0;
        let recordsFailed = 0;
        let recordsProcessed = 0;
        let offset = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const records = await this.fetchSolidxRecordsToImport(payload.solidxModelName, payload.odooId, offset, batchSize);
            if (!records.length) {
                break;
            }
            offset += records.length;

            for (const record of records) {
                recordsProcessed++;
                try {
                    const domain: any[] = [['model', '=', payload.odooModelName], ['res_id', '=', record.odooId]];
                    if (payload.fromDate) {
                        domain.push(['date', '>=', payload.fromDate]);
                    }

                    // Odoo's search_read treats limit:0 as "return zero rows", not "no limit" -
                    // paginate properly instead, same as the outer SolidX record loop.
                    let messageOffset = 0;
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const messages: OdooMessage[] = await this.odooCallKw(
                            payload.odooBaseUrl,
                            payload.odooSessionCookie,
                            'mail.message',
                            'search_read',
                            [domain, ['id', 'res_id', 'date', 'author_id', 'body', 'tracking_value_ids', 'attachment_ids']],
                            { order: 'id asc', limit: batchSize, offset: messageOffset },
                        );

                        if (!messages || messages.length === 0) {
                            break;
                        }
                        messageOffset += messages.length;

                        for (const message of messages) {
                            const trackingValues = message.tracking_value_ids?.length
                                ? await this.odooCallKw(payload.odooBaseUrl, payload.odooSessionCookie, 'mail.tracking.value', 'read', [message.tracking_value_ids])
                                : [];

                            const attachments: OdooAttachmentStream[] = [];
                            for (const attachmentId of message.attachment_ids ?? []) {
                                attachments.push(await this.odooFetchAttachment(payload.odooBaseUrl, payload.odooSessionCookie, attachmentId));
                            }

                            const imported = await this.importMessageFromOdoo({
                                coModelName: payload.solidxModelName,
                                coModelEntityId: record.id,
                                odooMessageId: message.id,
                                messageBody: this.buildOdooMessageHtml(message, trackingValues),
                                createdAt: this.formatOdooDate(message.date),
                                attachments,
                            });

                            if (imported) {
                                messagesImported++;
                            } else {
                                messagesSkipped++;
                            }
                        }
                    }
                } catch (error: any) {
                    recordsFailed++;
                    this._logger.error(`Failed importing Odoo chatter for ${payload.solidxModelName} (odooId=${record.odooId}): ${error.message}`, error.stack);
                }
            }
        }

        return { recordsProcessed, messagesImported, messagesSkipped, recordsFailed };
    }

    /**
     * Idempotent single-message writer used by the Odoo import job. Unlike `postMessage`, this
     * is a trusted system operation with no active HTTP user, so it does not call
     * `assertRecordAccess` - it relies on `odooMessageId` uniqueness (checked here) instead of
     * a persisted job/checkpoint table for both dedup and resumability; see
     * `runOdooChatterImport`'s cursor derivation for the resume side of that.
     */
    async importMessageFromOdoo(input: {
        coModelName: string;
        coModelEntityId: number;
        odooMessageId: number;
        messageBody: string;
        createdAt: Date;
        attachments: OdooAttachmentStream[];
    }): Promise<ChatterMessage | null> {
        const existing = await this.repo.findOne({ where: { odooMessageId: input.odooMessageId } });
        if (existing) {
            return null;
        }

        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.CUSTOM;
        chatterMessage.messageSubType = CHATTER_MESSAGE_SUBTYPE.NOTE;
        chatterMessage.status = CHATTER_MESSAGE_STATUS.COMPLETED;
        chatterMessage.messageBody = input.messageBody;
        chatterMessage.coModelEntityId = input.coModelEntityId;
        chatterMessage.coModelName = input.coModelName;
        chatterMessage.odooMessageId = input.odooMessageId;
        // Backdate both timestamps to the original Odoo message date, not "now" - this is an
        // import of historical data, so nothing was actually created/updated in SolidX at import
        // time. createdAt alone isn't enough: @UpdateDateColumn defaults to the current time on
        // insert just like @CreateDateColumn would if left unset, so updatedAt must be set too or
        // it silently shows today's date regardless of createdAt being correct.
        chatterMessage.createdAt = input.createdAt;
        chatterMessage.updatedAt = input.createdAt;

        const model = await this.modelMetadataRepo.findOne({
            where: { singularName: input.coModelName },
            relations: { userKeyField: true, module: true },
        });
        chatterMessage.modelDisplayName = model?.displayName ?? null;

        this.stampMessageAuditFields(chatterMessage, this.getOdooImportSystemUserId());

        const savedMessage = await this.repo.save(chatterMessage);

        if (input.attachments?.length) {
            const chatterModel = await this.modelMetadataService.findOneBySingularName('chatterMessage', {
                fields: { model: true, mediaStorageProvider: true },
                module: true,
            });
            const mediaField = chatterModel?.fields?.find(field => field.type === 'mediaMultiple' && field.name === 'messageAttachments');

            if (mediaField) {
                const storageProviderType = mediaField.mediaStorageProvider.type as MediaStorageProviderType;
                const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);
                const streamPairs: [Readable, string, { mimeType?: string; originalFileName?: string }][] = input.attachments.map(attachment => [
                    attachment.stream,
                    `${uuidv4()}-${sanitizeStoredMediaFileName(attachment.originalFileName)}`,
                    { mimeType: attachment.mimeType, originalFileName: attachment.originalFileName },
                ]);
                await storageProvider.storeStreams(streamPairs, savedMessage, mediaField);
            } else {
                this._logger.warn(`Could not resolve "messageAttachments" media field on chatterMessage - skipping ${input.attachments.length} Odoo attachment(s) for message ${input.odooMessageId}`);
            }
        }

        return savedMessage;
    }

    async postAuditMessageOnInsert(entity: any, modelName: string, messageQueue: boolean = false, userId?: number | null) {
        if (!entity) {
            return;
        }
        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: lowerFirst(modelName)
            },
            relations: {
                fields: true,
                module: true,
                userKeyField: true
            }
        });

        if (!model || !model.enableAuditTracking) {
            return;
        }

        const auditFields = model.fields.filter(field =>
            field.enableAuditTracking &&
            !['mediaSingle', 'mediaMultiple', 'richText', 'json'].includes(field.type) &&
            !(field.type === 'relation' && field.relationType === 'one-to-many')
        );

        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.AUDIT;
        chatterMessage.messageSubType = CHATTER_MESSAGE_SUBTYPE.AUDIT_INSERT;
        chatterMessage.status = CHATTER_MESSAGE_STATUS.PENDING;
        chatterMessage.coModelEntityId = entity.id;
        chatterMessage.coModelName = model?.singularName;
        chatterMessage.modelDisplayName = model?.displayName;
        chatterMessage.modelUserKey = this.toUserKeyString(entity[model?.userKeyField?.name]);
        chatterMessage.messageBody = `New ${model?.displayName} created`;
        this.stampMessageAuditFields(chatterMessage, userId);

        const savedMessage = await this.repo.save(chatterMessage);

        for (const field of auditFields) {
            const fieldValue = entity[field.name];
            if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                const messageDetail = new ChatterMessageDetails();
                messageDetail.chatterMessage = savedMessage;
                messageDetail.fieldName = field.name;
                messageDetail.fieldDisplayName = field.displayName;
                messageDetail.fieldType = field.type;
                messageDetail.oldValue = null;
                messageDetail.oldValueDisplay = null;
                messageDetail.newValue = this.formatFieldValue(field, fieldValue);
                messageDetail.newValueDisplay = await this.formatFieldValueDisplay(field, fieldValue);
                await this.chatterMessageDetailsRepo.save(messageDetail);
            }
        }
    }

    async postAuditMessageOnUpdate(entity: any, modelName: string, databaseEntity: any, updatedColumns: any[] = [], messageQueue: boolean = false, userId?: number | null) {
        if (!databaseEntity || !entity) {
            return;
        }
        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: lowerFirst(modelName)
            },
            relations: {
                fields: true,
                module: true,
                userKeyField: true
            }
        });

        if (!model || !model.enableAuditTracking) {
            return;
        }

        const modelFields = await this.modelMetadataHelperService.loadFieldHierarchy(model.singularName)

        const auditFields = modelFields.filter(field =>
            field.enableAuditTracking &&
            !['mediaSingle', 'mediaMultiple', 'richText', 'json'].includes(field.type) &&
            !(field.type === 'relation' && field.relationType === 'one-to-many')
        );

        const updatedFieldNames = new Set(updatedColumns.map(col => col.propertyName));

        const allNonRelationFields = auditFields.filter(field => field.type !== 'relation');
        const allRelationFields = auditFields.filter(field => field.type === 'relation');

        let potentialNonRelationFields = [];

        if (updatedColumns.length > 0) {
            potentialNonRelationFields = allNonRelationFields.filter(field =>
                updatedFieldNames.has(field.name)
            );
        } else {
            potentialNonRelationFields = allNonRelationFields;
        }

        const potentialRelationFields = allRelationFields;

        const changedNonRelationFields = potentialNonRelationFields.filter(field => {
            const newValue = entity[field.name];
            const oldValue = databaseEntity[field.name];
            return this.hasValueChanged(newValue, oldValue);
        });

        const changedRelationFields = [];
        if (potentialRelationFields.length > 0) {
            const metadata = this.entityManager.connection.entityMetadatas.find(m => m.name === modelName);
            const populatedOldEntity = await this.populateRelationFields(databaseEntity, potentialRelationFields, metadata);

            for (const field of potentialRelationFields) {
                const newValue = entity[field.name];
                const oldValue = populatedOldEntity[field.name];

                if (this.hasRelationValueChanged(field, newValue, oldValue)) {
                    changedRelationFields.push({
                        field,
                        newValue,
                        oldValue
                    });
                }
            }
        }

        const allChangedFields = [
            ...changedNonRelationFields.map(field => ({
                field,
                newValue: entity[field.name],
                oldValue: databaseEntity[field.name]
            })),
            ...changedRelationFields
        ];

        if (allChangedFields.length === 0) {
            return;
        }

        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.AUDIT;
        chatterMessage.messageSubType = CHATTER_MESSAGE_SUBTYPE.AUDIT_UPDATE;
        chatterMessage.status = CHATTER_MESSAGE_STATUS.PENDING;
        chatterMessage.coModelEntityId = entity?.id;
        chatterMessage.coModelName = model?.singularName;
        chatterMessage.modelDisplayName = model.displayName;
        chatterMessage.modelUserKey = this.toUserKeyString(entity[model?.userKeyField?.name]);
        chatterMessage.messageBody = `${model?.displayName} updated`;
        this.stampMessageAuditFields(chatterMessage, userId);

        const savedMessage = await this.repo.save(chatterMessage);

        for (const { field, newValue, oldValue } of allChangedFields) {
            const messageDetail = new ChatterMessageDetails();
            messageDetail.chatterMessage = savedMessage;
            messageDetail.fieldName = field.name;
            messageDetail.fieldDisplayName = field.displayName;
            messageDetail.fieldType = field.type;
            messageDetail.oldValue = this.formatFieldValue(field, oldValue);
            messageDetail.newValue = this.formatFieldValue(field, newValue);
            messageDetail.oldValueDisplay = await this.formatFieldValueDisplay(field, oldValue);
            messageDetail.newValueDisplay = await this.formatFieldValueDisplay(field, newValue);
            await this.chatterMessageDetailsRepo.save(messageDetail);
        }
    }

    async postAuditMessageOnDelete(modelName: string, databaseEntity: any, messageQueue: boolean = false, userId?: number | null) {
        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: lowerFirst(modelName)
            },
            relations: {
                module: true,
                userKeyField: true
            }
        });

        if (!model || !model.enableAuditTracking) {
            return;
        }

        const modelFields = await this.modelMetadataHelperService.loadFieldHierarchy(model.singularName);

        const auditFields = modelFields.filter(field =>
            field.enableAuditTracking &&
            !['mediaSingle', 'mediaMultiple', 'richText', 'json'].includes(field.type) &&
            !(field.type === 'relation' && field.relationType === 'one-to-many')
        );

        // Populate relation fields so display values (e.g. names) are resolvable.
        // The related entities themselves still exist in the DB after a delete.
        const relationFields = auditFields.filter(field => field.type === 'relation');
        const entityMetadata = this.entityManager.connection.entityMetadatas.find(m => m.name === modelName);
        const populatedEntity = relationFields.length > 0 && entityMetadata
            ? await this.populateRelationFields(databaseEntity, relationFields, entityMetadata)
            : { ...databaseEntity };

        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.AUDIT;
        chatterMessage.messageSubType = CHATTER_MESSAGE_SUBTYPE.AUDIT_DELETE;
        chatterMessage.status = CHATTER_MESSAGE_STATUS.PENDING;
        chatterMessage.coModelEntityId = databaseEntity?.id;
        chatterMessage.coModelName = model?.singularName;
        chatterMessage.modelDisplayName = model?.displayName;
        chatterMessage.modelUserKey = this.toUserKeyString(databaseEntity[model?.userKeyField?.name]);
        chatterMessage.messageBody = `${model?.displayName} deleted`;

        this.stampMessageAuditFields(chatterMessage, userId);

        const savedMessage = await this.repo.save(chatterMessage);

        for (const field of auditFields) {
            const fieldValue = populatedEntity[field.name];
            if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                const messageDetail = new ChatterMessageDetails();
                messageDetail.chatterMessage = savedMessage;
                messageDetail.fieldName = field.name;
                messageDetail.fieldDisplayName = field.displayName;
                messageDetail.fieldType = field.type;
                messageDetail.oldValue = this.formatFieldValue(field, fieldValue);
                messageDetail.oldValueDisplay = await this.formatFieldValueDisplay(field, fieldValue);
                messageDetail.newValue = null;
                messageDetail.newValueDisplay = null;
                await this.chatterMessageDetailsRepo.save(messageDetail);
            }
        }
    }

    private formatFieldValue(field: any, value: any): string {
        if (value === null || value === undefined) {
            return '';
        }

        if (field.type === 'selectionStatic' || field.type === 'selectionDynamic') {
            return `${value}`;
        }

        if (field.type === 'relation') {
            if (field.relationType === "many-to-one") {
                return value.id;
            }
            if (field.relationType === 'many-to-many') {
                return value.map(item => item.id).join(', ');
            }
        }

        if (value instanceof Date) {
            return serializeDate(value);
        }

        return value.toString();
    }

    private async formatFieldValueDisplay(field: any, value: any): Promise<string> {
        if (value === null || value === undefined) {
            return '';
        }

        if (field.type === 'selectionStatic' || field.type === 'selectionDynamic') {
            return `${value}`;
        }

        if (['date', 'datetime', 'time'].includes(field.type)) {
            return null;
        }

        if (field.type === 'relation') {
            if (field.relationType === "many-to-one") {
                const relatedModel = await this.loadRelatedModelForDisplay(field);
                return this.resolveRelationDisplayValue(value, relatedModel?.userKeyField?.name);
            }

            if (field.relationType === 'many-to-many') {
                if (!Array.isArray(value)) {
                    const relatedModel = await this.loadRelatedModelForDisplay(field);
                    return this.resolveRelationDisplayValue(value, relatedModel?.userKeyField?.name);
                }

                const relatedModel = await this.loadRelatedModelForDisplay(field);
                const userKeyFieldName = relatedModel?.userKeyField?.name;
                return value
                    .map(item => this.resolveRelationDisplayValue(item, userKeyFieldName))
                    .filter(Boolean)
                    .join(', ');
            }
        }

        return value.toString();
    }

    private async loadRelatedModelForDisplay(field: any): Promise<any | null> {
        try {
            return await this.modelMetadataRepo.findOne({
                where: { singularName: field.relationCoModelSingularName || field.relation },
                relations: { userKeyField: true }
            });
        } catch (error: any) {
            this._logger.warn(`Unable to load related model metadata for audit display: ${error?.message ?? error}`);
            return null;
        }
    }

    private resolveRelationDisplayValue(value: any, userKeyFieldName?: string): string {
        if (value === null || value === undefined) {
            return '';
        }

        if (typeof value !== 'object') {
            return String(value);
        }

        const candidateKeys = [
            userKeyFieldName,
            'fullName',
            'displayName',
            'username',
            'name',
            'title',
            'id',
        ].filter(Boolean) as string[];

        for (const key of candidateKeys) {
            const candidate = value[key];
            if (candidate !== null && candidate !== undefined && String(candidate).trim() !== '') {
                return String(candidate);
            }
        }

        return '';
    }

    private hasValueChanged(newValue: any, oldValue: any): boolean {
        if (newValue === oldValue) {
            return false;
        }

        if (newValue === null && oldValue === null) {
            return false;
        }

        if (newValue === undefined && oldValue === undefined) {
            return false;
        }

        if (newValue && oldValue && typeof newValue === 'object' && typeof oldValue === 'object') {
            if (newValue.id !== undefined && oldValue.id !== undefined) {
                return newValue.id !== oldValue.id;
            }

            if (Array.isArray(newValue) && Array.isArray(oldValue)) {
                if (newValue.length !== oldValue.length) {
                    return true;
                }
                const newIds = newValue.map(item => item.id || item).sort();
                const oldIds = oldValue.map(item => item.id || item).sort();
                return JSON.stringify(newIds) !== JSON.stringify(oldIds);
            }
        }

        if (Array.isArray(newValue) && Array.isArray(oldValue)) {
            return JSON.stringify(newValue) !== JSON.stringify(oldValue);
        }

        return true;
    }

    private hasRelationValueChanged(field: any, newValue: any, oldValue: any): boolean {
        if (newValue === oldValue) {
            return false;
        }

        if ((newValue === null || newValue === undefined) && (oldValue === null || oldValue === undefined)) {
            return false;
        }

        if (field.relationType === 'many-to-one') {
            const newId = this.extractRelationId(newValue);
            const oldId = this.extractRelationId(oldValue);
            return newId !== oldId;
        }

        if (field.relationType === 'many-to-many') {
            const newIds = this.extractRelationIds(newValue);
            const oldIds = this.extractRelationIds(oldValue);

            if (newIds.length !== oldIds.length) {
                return true;
            }

            newIds.sort();
            oldIds.sort();

            return JSON.stringify(newIds) !== JSON.stringify(oldIds);
        }

        return this.hasValueChanged(newValue, oldValue);
    }

    private extractRelationId(value: any): any {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string' || typeof value === 'number') {
            return value;
        }

        if (typeof value === 'object' && value.id !== undefined) {
            return value.id;
        }

        return null;
    }

    private extractRelationIds(value: any): any[] {
        if (!Array.isArray(value)) {
            const id = this.extractRelationId(value);
            return id !== null ? [id] : [];
        }

        return value.map(item => this.extractRelationId(item)).filter(id => id !== null);
    }

    private async populateRelationFields(databaseEntity: any, relationFields: any[], metadata: EntityMetadata): Promise<any> {
        const populatedEntity = { ...databaseEntity };

        for (const field of relationFields) {
            const relationValue = databaseEntity[field.name];

            if (relationValue === null || relationValue === undefined) {
                populatedEntity[field.name] = relationValue;
                continue;
            }

            const relationMetadata = metadata.relations.find(rel => rel.propertyName === field.name);
            if (!relationMetadata) {
                populatedEntity[field.name] = relationValue;
                continue;
            }

            const targetEntity = relationMetadata.inverseEntityMetadata || relationMetadata.type;

            if (field.relationType === 'many-to-one') {
                const relationId = this.extractRelationId(relationValue);
                if (relationId) {
                    const relatedEntity = await this.entityManager.findOne(targetEntity as any, {
                        where: { id: relationId }
                    });
                    populatedEntity[field.name] = relatedEntity;
                } else {
                    populatedEntity[field.name] = relationValue;
                }
            } else if (field.relationType === 'many-to-many' || field.relationType === 'manyToMany') {
                const relationIds = this.extractRelationIds(relationValue);
                if (relationIds.length > 0) {
                    const relatedEntities = await this.entityManager.findByIds(targetEntity as any, relationIds);
                    populatedEntity[field.name] = relatedEntities;
                } else {
                    populatedEntity[field.name] = relationValue;
                }
            } else {
                populatedEntity[field.name] = relationValue;
            }
        }

        return populatedEntity;
    }

    private logHeapUsed(label: string) {
        const mb = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        this._logger.log(`heapUsedMB(${label}): ${mb()}`);
    }

    // [2026-02-05T23:31:21.025Z] INFO: [200 OK] 
    // GET /api/chatter-message/getChatterMessages/216/mswipeBoomboxBulkUpload?populateMedia[0]=messageAttachments&populate[0]=user&populate[1]=chatterMessageDetails&limit=25 22747ms
    async getChatterMessages(entityId: number, entityName: string, query: any) {
        const { limit = 25, offset = 0, populate = [], populateMedia = [], filters } = query;
        this.logHeapUsed('getChatterMessages-start');

        await this.assertRecordAccess(lowerFirst(entityName), entityId);

        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: entityName
            },
        });
        this.logHeapUsed('getChatterMessages-modelLoaded');
        const oneToManyFields = await this.fieldMetadataRepo.find({
            where: {
                model: { id: model.id },
                type: 'relation',
                relationType: 'one-to-many'
            }
        });
        this.logHeapUsed('getChatterMessages-oneToManyFieldsLoaded');

        const relatedEntitiesMap = new Map<string, number[]>();

        for (const field of oneToManyFields) {
            if (field.enableAuditTracking === false) {
                this._logger.log(`Skipping field ${field.name} for chatter message retrieval because audit tracking is disabled`);
                continue
            }
            const coModelName = field.relationCoModelSingularName;
            const coModelFieldName = field.relationCoModelFieldName;

            const coModel = await this.modelMetadataRepo.findOne({
                where: { singularName: coModelName }
            });

            if (coModel) {
                //const relatedEntityRepository = this.entityManager.getRepository(classify(coModelName));
                const dsName = coModel.dataSource || 'default';
                const em = dsName === 'default' ? this.entityManager : this.moduleRef.get(`${dsName}EntityManager`, { strict: false });

                const relatedEntityRepository = em.getRepository(classify(coModelName));

                const relatedEntities = await relatedEntityRepository.find({
                    select: {
                        id: true,
                    },
                    where: { [coModelFieldName]: { id: entityId } },
                    take: 5,
                });

                const relatedIds = relatedEntities.map((entity: any) => entity.id);
                relatedEntitiesMap.set(field.name, relatedIds);
            }
        }
        this.logHeapUsed('getChatterMessages-relatedEntitiesLoaded');

        const qb = await this.repo.createSecurityRuleAwareQueryBuilder('entity');
        this.logHeapUsed('getChatterMessages-queryBuilderReady');

        const orConditions: string[] = [];
        const parameters: any = {};

        orConditions.push('(entity.coModelName = :entityName AND entity.coModelEntityId = :entityId)');
        parameters.entityName = entityName;
        parameters.entityId = entityId;

        let paramIndex = 0;
        for (const [fieldName, relatedIds] of relatedEntitiesMap.entries()) {
            if (relatedIds.length > 0) {
                const field = oneToManyFields.find(f => f.name === fieldName);
                if (field) {
                    const coModelName = field.relationCoModelSingularName;
                    const idsParamName = `relatedIds${paramIndex}`;
                    orConditions.push(`(entity.coModelName = :coModelName${paramIndex} AND entity.coModelEntityId IN (:...${idsParamName}))`);
                    parameters[`coModelName${paramIndex}`] = coModelName;
                    parameters[idsParamName] = relatedIds;
                    paramIndex++;
                }
            }
        }

        // SECURITY: must be andWhere. `where()` REPLACES every previously registered condition,
        // which would discard the row-level security rules applied by
        // createSecurityRuleAwareQueryBuilder above. (The inner `where` is safe: it is the first
        // condition on a fresh Brackets sub-builder.)
        qb.andWhere(new Brackets(qb => {
            qb.where(orConditions.join(' OR '), parameters);
        }));

        const relations = ['chatterMessageDetails'];
        if (populate && populate.length > 0) {
            const normalizedPopulate = this.crudHelperService.normalize(populate);
            // SECURITY: 'user' is joined below with an explicit column allowlist. A client-supplied
            // populate[]=user must not be able to turn it back into a full-entity join (the chatter
            // panel does send exactly that).
            relations.push(...normalizedPopulate.filter(rel => rel !== 'user' && !relations.includes(rel)));
        }

        relations.forEach(relation => {
            qb.leftJoinAndSelect(`entity.${relation}`, relation);
        });

        // Only the author's id and display name leave this endpoint - see CHATTER_MESSAGE_USER_FIELDS.
        // This join must stay before applyFilters below: it lets filters[user][fullName] reuse this
        // alias instead of adding a second join of its own.
        qb.leftJoin('entity.user', 'user');
        qb.addSelect(CHATTER_MESSAGE_USER_FIELDS.map(field => `user.${field}`));

        if (filters) {
            qb.andWhere(new Brackets(whereQb => {
                this.crudHelperService.applyFilters(whereQb, filters, 'entity', qb);
            }));
        }

        qb.orderBy('entity.createdAt', 'DESC');

        qb.skip(offset).take(limit);

        const [entities, count] = await qb.getManyAndCount();
        this.logHeapUsed('getChatterMessages-entitiesLoaded');

        // The join above only selects the allowlisted columns, but TypeORM still hydrates the
        // author with `new User()`, which leaves every initialiser-backed property (active,
        // forcePasswordChange, ...) sitting on the instance holding its default rather than a
        // value read from the database. Replace it with a plain object of exactly the
        // allowlisted keys so the response cannot report fabricated defaults as data.
        this.trimMessageUsers(entities);

        // Convert date strings in message details to ISO format for consistent handling on the frontend
        const DATE_FIELD_TYPES = ['date', 'datetime', 'time'];
        for (const entity of entities) {
            for (const detail of entity.chatterMessageDetails ?? []) {
                if (!detail.fieldType || !DATE_FIELD_TYPES.includes(detail.fieldType)) continue;
                if (detail.oldValue) {
                    const d = LocalDateTimeTransformer.from(detail.oldValue);
                    if (d) detail.oldValue = d.toISOString();
                }
                if (detail.newValue) {
                    const d = LocalDateTimeTransformer.from(detail.newValue);
                    if (d) detail.newValue = d.toISOString();
                }
            }
        }

        if (populateMedia && populateMedia.length > 0) {
            const normalizedPopulateMedia = this.crudHelperService.normalize(populateMedia);
            this.logHeapUsed('getChatterMessages-beforePopulateMedia');
            await this['handlePopulateMedia'](normalizedPopulateMedia, entities);
            this.logHeapUsed('getChatterMessages-afterPopulateMedia');
        }

        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(count / limit);
        const nextPage = currentPage < totalPages ? currentPage + 1 : null;
        const prevPage = currentPage > 1 ? currentPage - 1 : null;

        return {
            meta: {
                totalRecords: count,
                currentPage: currentPage,
                nextPage: nextPage,
                prevPage: prevPage,
                totalPages: totalPages,
                perPage: +limit,
            },
            records: entities
        };
    }

    // model_user_key is a varchar column, but a model's user key field can be numeric (e.g. an int `id`).
    // Drivers like mssql reject non-string values for string parameters, so always persist it as a string.
    private toUserKeyString(value: unknown): string | null {
        return value === null || value === undefined ? null : String(value);
    }
}
