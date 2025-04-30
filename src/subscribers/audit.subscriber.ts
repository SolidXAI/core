import { Connection, EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { ChatterMessageService } from '../services/chatter-message.service';
import { EntityMetadata } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
    
    constructor(
        private readonly connection: Connection,    
        private readonly chatterMessageService: ChatterMessageService,
        @InjectRepository(ModelMetadata)
        private readonly modelMetadataRepo: Repository<ModelMetadata>,
    ) {
        connection.subscribers.push(this);
    }

    private async shouldTrackAudit(entity: any, metadata: EntityMetadata): Promise<boolean> {
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
            return false;
        }

        const auditFields = model.fields.filter(field => 
            field.enableAuditTracking && 
            !['mediaSingle', 'mediaMultiple', 'computed', 'richText', 'json'].includes(field.type) &&
            !(field.type === 'relation' && field.relationType === 'one-to-many')
        );

        if (auditFields.length === 0) {
            return false;
        }

        return auditFields.some(field => {
            const fieldValue = entity[field.name];
            return fieldValue !== undefined && fieldValue !== null;
        });
    }

    async afterInsert(event: InsertEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            await this.chatterMessageService.postAuditMessageOnInsert(event.entity, event.metadata);
        }
    }

    async afterUpdate(event: UpdateEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            await this.chatterMessageService.postAuditMessageOnUpdate(event.entity, event.metadata, event.databaseEntity);
        }
    }

    async afterRemove(event: RemoveEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            await this.chatterMessageService.postAuditMessageOnDelete(event.entity, event.metadata, event.databaseEntity);
        }
    }
} 