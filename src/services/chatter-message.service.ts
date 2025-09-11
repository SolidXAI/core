import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef  } from "@nestjs/core";
import { EntityManager, Repository, EntityMetadata } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { PostChatterMessageDto } from 'src/dtos/post-chatter-message.dto';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';
import { ChatterMessage } from '../entities/chatter-message.entity';
import { getMediaStorageProvider } from './mediaStorageProviders';
import { MediaStorageProviderType } from '../dtos/create-media-storage-provider-metadata.dto';
import { ChatterMessageDetails } from '../entities/chatter-message-details.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { RequestContextService } from './request-context.service';
import { ChatterMessageRepository } from 'src/repository/chatter-message.repository';
@Injectable()
export class ChatterMessageService extends CRUDService<ChatterMessage>{
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ChatterMessage, 'default')
    readonly repo: ChatterMessageRepository,
    @InjectRepository(ChatterMessageDetails, 'default')
    readonly chatterMessageDetailsRepo: Repository<ChatterMessageDetails>,
    readonly moduleRef: ModuleRef,
    @InjectRepository(ModelMetadata)
    private readonly modelMetadataRepo: Repository<ModelMetadata>,
    readonly requestContextService: RequestContextService
 ) {
   super(modelMetadataService, moduleMetadataService,  configService, fileService,  discoveryService, crudHelperService,entityManager, repo, 'chatterMessage', 'solid-core', moduleRef);
 }

 async postMessage(postDto: PostChatterMessageDto, files: Express.Multer.File[] = []) {
    const chatterMessage = new ChatterMessage();
    chatterMessage.messageType = 'custom';
    chatterMessage.messageSubType = postDto.messageSubType || 'post_message';
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
    if(!entity){
        return;
    }
    const model = await this.modelMetadataRepo.findOne({
        where: {
            displayName: metadata.name
        },
        relations: {
            fields: true,
            module: true
        }
    });

    if (!model || !model.enableAuditTracking) {
        return;
    }

    const auditFields = model.fields.filter(field => 
        field.enableAuditTracking && 
        !['mediaSingle', 'mediaMultiple', 'computed', 'richText', 'json'].includes(field.type) &&
        !(field.type === 'relation' && field.relationType === 'one-to-many')
    );

    const activeUser = this.requestContextService.getActiveUser();

    const chatterMessage = new ChatterMessage();
    chatterMessage.messageType = 'audit';
    chatterMessage.messageSubType = 'insert';
    chatterMessage.coModelEntityId = entity.id;
    chatterMessage.coModelName = model.singularName;
    chatterMessage.messageBody = `New ${model.displayName} created`;
    
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
            messageDetail.oldValue = null;
            messageDetail.oldValueDisplay = null;
            messageDetail.newValue = this.formatFieldValue(field, fieldValue);
            messageDetail.newValueDisplay = this.formatFieldValueDisplay(field, fieldValue);
            await this.chatterMessageDetailsRepo.save(messageDetail);
        }
    }
}

async postAuditMessageOnUpdate(entity: any, metadata: EntityMetadata, databaseEntity: any, updatedColumns: any[] = [], messageQueue: boolean = false) {
    if(!databaseEntity || !entity){
        return;
    }
    const model = await this.modelMetadataRepo.findOne({
        where: {
            displayName: metadata.name
        },
        relations: {
            fields: true,
            module: true
        }
    });

    if (!model || !model.enableAuditTracking) {
        return;
    }

    const auditFields = model.fields.filter(field => 
        field.enableAuditTracking && 
        !['mediaSingle', 'mediaMultiple', 'computed', 'richText', 'json'].includes(field.type) &&
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
    chatterMessage.messageType = 'audit';
    chatterMessage.messageSubType = 'update';
    chatterMessage.coModelEntityId = entity.id;
    chatterMessage.coModelName = model.singularName;
    chatterMessage.messageBody = `${model.displayName} updated`;
    
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
        messageDetail.oldValue = this.formatFieldValue(field, oldValue);
        messageDetail.newValue = this.formatFieldValue(field, newValue);
        messageDetail.oldValueDisplay = this.formatFieldValueDisplay(field, oldValue);
        messageDetail.newValueDisplay = this.formatFieldValueDisplay(field, newValue);
        await this.chatterMessageDetailsRepo.save(messageDetail);
    }
}

async postAuditMessageOnDelete(entity: any, metadata: EntityMetadata, databaseEntity: any, messageQueue: boolean = false) {
    const model = await this.modelMetadataRepo.findOne({
        where: {
            displayName: metadata.name
        },
        relations: {
            fields: true,
            module: true
        }
    });

    if (!model || !model.enableAuditTracking) {
        return;
    }

    const chatterMessage = new ChatterMessage();
    chatterMessage.messageType = 'audit';
    chatterMessage.messageSubType = 'delete';
    chatterMessage.coModelEntityId = databaseEntity.id;
    chatterMessage.coModelName = model.singularName;
    chatterMessage.messageBody = `${model.displayName} deleted`;
    
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
        if (field.relationType === 'manyToMany') {
            return value.map(item => item.id).join(', ');
        }
    }


    return value.toString();
}

private formatFieldValueDisplay(field: any, value: any): string {
    if (value === null || value === undefined) {
        return '';
    }

    if (field.type === 'selectionStatic' || field.type === 'selectionDynamic') {
        return `${value}`;
    }

    if (field.type === 'relation') {
        if (field.relationType === "many-to-one") {
            return value.name;
        }
        if (field.relationType === 'many-toMany') {
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

    if (field.relationType === 'many-to-many' || field.relationType === 'manyToMany') {
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
}
