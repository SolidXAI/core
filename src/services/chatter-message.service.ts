import dayjs from 'dayjs';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { Brackets, EntityManager, EntityMetadata } from 'typeorm';

import { classify } from '@angular-devkit/core/src/utils/strings';
import { CHATTER_MESSAGE_SUBTYPE, CHATTER_MESSAGE_TYPE } from 'src/constants/chatter-message.constants';
import { PostChatterMessageDto } from 'src/dtos/post-chatter-message.dto';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { lowerFirst } from 'src/helpers/string.helper';
import { ChatterMessageDetailsRepository } from 'src/repository/chatter-message-details.repository';
import { ChatterMessageRepository } from 'src/repository/chatter-message.repository';
import { FieldMetadataRepository } from 'src/repository/field-metadata.repository';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { CRUDService } from 'src/services/crud.service';
import { MediaStorageProviderType } from '../dtos/create-media-storage-provider-metadata.dto';
import { ChatterMessageDetails } from '../entities/chatter-message-details.entity';
import { ChatterMessage } from '../entities/chatter-message.entity';
import { getMediaStorageProvider } from './mediaStorageProviders';
import { RequestContextService } from './request-context.service';
import { Logger } from '@nestjs/common';

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
    ) {
        super(entityManager, repo, 'chatterMessage', 'solid-core', moduleRef);
    }

    async postMessage(postDto: PostChatterMessageDto, files: Express.Multer.File[] = []) {
        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.CUSTOM;
        chatterMessage.messageSubType = postDto.messageSubType || CHATTER_MESSAGE_SUBTYPE.CUSTOM;
        chatterMessage.messageBody = postDto.messageBody;
        chatterMessage.coModelEntityId = postDto.coModelEntityId;
        chatterMessage.coModelName = postDto.coModelName;

        const activeUser = this.requestContextService.getActiveUser();

        if (activeUser) {
            const userId = activeUser?.sub;
            chatterMessage.user = { id: userId } as any;
        } else {
            chatterMessage.user = null;
        }

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

        return savedMessage;
    }

    async postAuditMessageOnInsert(entity: any, metadata: EntityMetadata, messageQueue: boolean = false) {
        if (!entity) {
            return;
        }
        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: lowerFirst(metadata.name)
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

        const activeUser = this.requestContextService.getActiveUser();

        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.AUDIT;
        chatterMessage.messageSubType = CHATTER_MESSAGE_SUBTYPE.AUDIT_INSERT;
        chatterMessage.coModelEntityId = entity.id;
        chatterMessage.coModelName = model?.singularName;
        chatterMessage.modelDisplayName = model?.displayName;
        chatterMessage.modelUserKey = entity[model?.userKeyField?.name];
        chatterMessage.messageBody = `New ${model?.displayName} created`;

        if (activeUser) {
            const userId = activeUser?.sub;
            chatterMessage.user = { id: userId } as any;
        } else {
            chatterMessage.user = null;
        }

        const savedMessage = await this.repo.save(chatterMessage);

        for (const field of auditFields) {
            const fieldValue = entity[field.name];
            if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                const messageDetail = new ChatterMessageDetails();
                messageDetail.chatterMessage = savedMessage;
                messageDetail.fieldName = field.name;
                messageDetail.fieldDisplayName = field.displayName;
                messageDetail.oldValue = null;
                messageDetail.oldValueDisplay = null;
                messageDetail.newValue = this.formatFieldValue(field, fieldValue);
                messageDetail.newValueDisplay = await this.formatFieldValueDisplay(field, fieldValue);
                await this.chatterMessageDetailsRepo.save(messageDetail);
            }
        }
    }

    async postAuditMessageOnUpdate(entity: any, metadata: EntityMetadata, databaseEntity: any, updatedColumns: any[] = [], messageQueue: boolean = false) {
        if (!databaseEntity || !entity) {
            return;
        }
        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: lowerFirst(metadata.name)
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

        const activeUser = this.requestContextService.getActiveUser();

        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.AUDIT;
        chatterMessage.messageSubType = CHATTER_MESSAGE_SUBTYPE.AUDIT_UPDATE;
        chatterMessage.coModelEntityId = entity?.id;
        chatterMessage.coModelName = model?.singularName;
        chatterMessage.modelDisplayName = model.displayName;
        chatterMessage.modelUserKey = entity[model?.userKeyField?.name];
        chatterMessage.messageBody = `${model?.displayName} updated`;

        if (activeUser) {
            const userId = activeUser?.sub;
            chatterMessage.user = { id: userId } as any;
        } else {
            chatterMessage.user = null;
        }

        const savedMessage = await this.repo.save(chatterMessage);

        for (const { field, newValue, oldValue } of allChangedFields) {
            const messageDetail = new ChatterMessageDetails();
            messageDetail.chatterMessage = savedMessage;
            messageDetail.fieldName = field.name;
            messageDetail.fieldDisplayName = field.displayName;
            messageDetail.oldValue = this.formatFieldValue(field, oldValue);
            messageDetail.newValue = this.formatFieldValue(field, newValue);
            messageDetail.oldValueDisplay = await this.formatFieldValueDisplay(field, oldValue);
            messageDetail.newValueDisplay = await this.formatFieldValueDisplay(field, newValue);
            await this.chatterMessageDetailsRepo.save(messageDetail);
        }
    }

    async postAuditMessageOnDelete(entity: any, metadata: EntityMetadata, databaseEntity: any, messageQueue: boolean = false) {
        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: lowerFirst(metadata.name)
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

        const chatterMessage = new ChatterMessage();
        chatterMessage.messageType = CHATTER_MESSAGE_TYPE.AUDIT;
        chatterMessage.messageSubType = CHATTER_MESSAGE_SUBTYPE.AUDIT_DELETE;
        chatterMessage.coModelEntityId = databaseEntity?.id;
        chatterMessage.coModelName = model?.singularName;
        chatterMessage.modelDisplayName = model?.displayName;
        chatterMessage.modelUserKey = entity[model?.userKeyField?.name];
        chatterMessage.messageBody = `${model?.displayName} deleted`;

        const activeUser = this.requestContextService.getActiveUser();

        if (activeUser) {
            const userId = activeUser?.sub;
            chatterMessage.user = { id: userId } as any;
        } else {
            chatterMessage.user = null;
        }

        await this.repo.save(chatterMessage);
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
            return value.toISOString();
        }

        return value.toString();
    }

    private formatDateForDisplay(field: any, value: any): string {
        const date = dayjs(value);

        if (!date.isValid()) {
            return value?.toString?.() ?? '';
        }

        if (field.type === 'date') {
            return date.format('DD-MM-YYYY');
        }

        if (field.type === 'time') {
            return date.format('HH:mm');
        }

        return date.format('DD-MM-YYYY HH:mm');
    }

    private async formatFieldValueDisplay(field: any, value: any): Promise<string> {
        if (value === null || value === undefined) {
            return '';
        }

        if (field.type === 'selectionStatic' || field.type === 'selectionDynamic') {
            return `${value}`;
        }

        if (['date', 'datetime', 'time'].includes(field.type)) {
            return this.formatDateForDisplay(field, value);
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
                } catch (error) {
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

        qb.where(new Brackets(qb => {
            qb.where(orConditions.join(' OR '), parameters);
        }));

        const relations = ['chatterMessageDetails', 'user'];
        if (populate && populate.length > 0) {
            const normalizedPopulate = this.crudHelperService.normalize(populate);
            relations.push(...normalizedPopulate.filter(rel => !relations.includes(rel)));
        }

        relations.forEach(relation => {
            qb.leftJoinAndSelect(`entity.${relation}`, relation);
        });

        if (filters) {
            qb.andWhere(new Brackets(whereQb => {
                this.crudHelperService.applyFilters(whereQb, filters, 'entity', qb);
            }));
        }

        qb.orderBy('entity.createdAt', 'DESC');

        qb.skip(offset).take(limit);

        const [entities, count] = await qb.getManyAndCount();
        this.logHeapUsed('getChatterMessages-entitiesLoaded');

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
