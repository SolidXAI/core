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
    @InjectRepository(ChatterMessage, 'default')
    readonly repo: Repository<ChatterMessage>,
    @InjectRepository(ChatterMessageDetails, 'default')
    readonly chatterMessageDetailsRepo: Repository<ChatterMessageDetails>,
    readonly moduleRef: ModuleRef,
    @InjectRepository(ModelMetadata)
    private readonly modelMetadataRepo: Repository<ModelMetadata>,

 ) {
   super(modelMetadataService, moduleMetadataService,  configService, fileService,  discoveryService, crudHelperService,entityManager, repo, 'chatterMessage', 'solid-core', moduleRef);
 }

 async postMessage(postDto: PostChatterMessageDto, solidRequestContext: SolidRequestContextDto, files: Express.Multer.File[] = []) {
    const chatterMessage = new ChatterMessage();
    chatterMessage.messageType = 'custom';
    chatterMessage.messageSubType = postDto.messageSubType || 'general';
    chatterMessage.messageBody = postDto.messageBody;
    chatterMessage.coModelEntityId = postDto.coModelEntityId;
    chatterMessage.coModelName = postDto.coModelName;
    
    const userId = typeof solidRequestContext.activeUser === 'object' 
        ? solidRequestContext.activeUser.sub 
        : solidRequestContext.activeUser;
    
    chatterMessage.user = { id: userId } as any;

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

 async postAuditMessageOnInsert(entity: any, metadata: EntityMetadata) {
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
        !['oneToMany', 'mediaSingle', 'mediaMultiple', 'computed', 'richText', 'json'].includes(field.type)
    );

    const chatterMessage = new ChatterMessage();
    chatterMessage.messageType = 'audit';
    chatterMessage.messageSubType = 'insert';
    chatterMessage.coModelEntityId = entity.id;
    chatterMessage.coModelName = model.singularName;
    chatterMessage.messageBody = `New ${model.displayName} created`;
    // For audit messages, we'll use null since they are system-generated
    chatterMessage.user = null;

    const savedMessage = await this.repo.save(chatterMessage);

    for (const field of auditFields) {
        const fieldValue = entity[field.name];
        if (fieldValue !== undefined && fieldValue !== null) {
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

async postAuditMessageOnUpdate(entity: any, metadata: EntityMetadata, databaseEntity: any) {
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
        !['oneToMany', 'mediaSingle', 'mediaMultiple', 'computed', 'richText', 'json'].includes(field.type)
    );

    const changedFields = auditFields.filter(field => {
        const newValue = entity[field.name];
        const oldValue = databaseEntity[field.name];
        return this.hasValueChanged(newValue, oldValue);
    });

    if (changedFields.length === 0) {
        return;
    }

    const chatterMessage = new ChatterMessage();
    chatterMessage.messageType = 'audit';
    chatterMessage.messageSubType = 'update';
    chatterMessage.coModelEntityId = entity.id;
    chatterMessage.coModelName = model.singularName;
    chatterMessage.messageBody = `${model.displayName} updated`;
    // For audit messages, we'll use null since they are system-generated
    chatterMessage.user = null;

    const savedMessage = await this.repo.save(chatterMessage);

    for (const field of changedFields) {
        const messageDetail = new ChatterMessageDetails();
        messageDetail.chatterMessage = savedMessage;
        messageDetail.fieldName = field.name;
        messageDetail.oldValue = this.formatFieldValue(field, databaseEntity[field.name]);
        messageDetail.newValue = this.formatFieldValue(field, entity[field.name]);
        messageDetail.oldValueDisplay = this.formatFieldValueDisplay(field, databaseEntity[field.name]);
        messageDetail.newValueDisplay = this.formatFieldValueDisplay(field, entity[field.name]);
        await this.chatterMessageDetailsRepo.save(messageDetail);
    }
}

async postAuditMessageOnDelete(entity: any, metadata: EntityMetadata) {
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
    chatterMessage.coModelEntityId = entity.id;
    chatterMessage.coModelName = model.singularName;
    chatterMessage.messageBody = `${model.displayName} deleted`;
    // For audit messages, we'll use a system user ID or leave it null
    chatterMessage.user = null;

    await this.repo.save(chatterMessage);
}

private formatFieldValue(field: any, value: any): string {
    if (value === null || value === undefined) {
        return '';
    }

    if (field.type === 'selectionStatic' || field.type === 'selectionDynamic') {
        return `${value.value}`;
    }

    if (field.type === 'manyToOne') {
        return value.value;
    }

    if (field.type === 'manyToMany') {
        return '';
    }

    return value.toString();
}

private formatFieldValueDisplay(field: any, value: any): string {
    if (value === null || value === undefined) {
        return '';
    }

    if (field.type === 'selectionStatic' || field.type === 'selectionDynamic') {
        return `${value.value}`;
    }

    if (field.type === 'manyToOne') {
        return value.value;
    }

    if (field.type === 'manyToMany') {
        return '';
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

    if (Array.isArray(newValue) && Array.isArray(oldValue)) {
        return JSON.stringify(newValue) !== JSON.stringify(oldValue);
    }

    return true;
}
}
