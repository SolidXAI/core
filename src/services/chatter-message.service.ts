import { LocalDateTimeTransformer, serializeDate } from 'src/transformers/typeorm/local-date-time-transformer';
import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { Brackets, EntityManager, EntityMetadata, In } from 'typeorm';

import { classify } from '@angular-devkit/core/src/utils/strings';
import { CHATTER_MESSAGE_STATUS, CHATTER_MESSAGE_SUBTYPE, CHATTER_MESSAGE_TYPE, CHATTER_MESSAGE_USER_FIELDS } from 'src/constants/chatter-message.constants';
import { isDangerousMediaFile } from 'src/constants/media-file-types';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { PostChatterMessageDto } from 'src/dtos/post-chatter-message.dto';
import { UpdateChatterNoteMessageDto } from 'src/dtos/update-chatter-note-message.dto';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { lowerFirst } from 'src/helpers/string.helper';
import { ChatterMentionNotificationPayload } from 'src/interfaces/chatter-mention-notification.interface';
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

interface ChatterMention {
    username: string;
    display_name?: string;
    displayName?: string;
    id?: string | number;
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
            const model = await this.modelMetadataService.findOneBySingularName('chatterMessage', {
                fields: {
                    model: true,
                    mediaStorageProvider: true,
                },
                module: true,
            });

            const mediaFields = model.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple');
            const attachmentFieldIds = mediaFields.map(field => field.id);

            if (removeAttachmentIds.length > 0 && attachmentFieldIds.length > 0) {
                const mediaToRemove = await this.mediaRepository.find({
                    where: {
                        id: In(removeAttachmentIds),
                        entityId: savedMessage.id,
                        modelMetadata: { id: model.id },
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

    async postMessage(postDto: PostChatterMessageDto, files: Express.Multer.File[] = []) {
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
        chatterMessage.modelUserKey = postDto.modelUserKey ?? null;
        chatterMessage.createdAt = postDto.createdAt ?? new Date();

        const model = await this.modelMetadataRepo.findOne({
            where: { singularName: coModelName },
            relations: { userKeyField: true, module: true }
        });
        chatterMessage.modelDisplayName = model?.displayName ?? null;

        this.stampMessageAuditFields(chatterMessage);

        const savedMessage = await this.repo.save(chatterMessage);

        if (files && files.length > 0) {
            const model = await this.modelMetadataService.findOneBySingularName('chatterMessage', {
                fields: {
                    model: true,
                    mediaStorageProvider: true,
                },
                module: true,
            });

            const mediaFields = model.fields.filter(field => field.type === 'mediaSingle' || field.type === 'mediaMultiple');

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
        chatterMessage.modelUserKey = entity[model?.userKeyField?.name];
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
        chatterMessage.modelUserKey = entity[model?.userKeyField?.name];
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
        chatterMessage.modelUserKey = databaseEntity[model?.userKeyField?.name];
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
                if (value.name) {
                    return value.name;
                }

                try {
                    const relatedModel = await this.modelMetadataRepo.findOne({
                        where: { singularName: field.relationCoModelSingularName || field.relation },
                        relations: { userKeyField: true }
                    });

                    if (relatedModel && relatedModel.userKeyField) {
                        const userKeyFieldName = relatedModel.userKeyField.name;
                        return value[userKeyFieldName] ? value[userKeyFieldName].toString() : '';
                    }

                    if (value.id) {
                        return value.id.toString();
                    }
                } catch (error: any) {
                    console.error('Error fetching related model metadata:', error);
                    return value.id ? value.id.toString() : '';
                }
            }

            if (field.relationType === 'many-to-many') {
                return value.map(item => item.name).join(', ');
            }
        }

        return value.toString();
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
}
