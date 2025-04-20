import { Connection, EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatterMessageService } from '../services/chatter-message.service';
import { ModelMetadataService } from '../services/model-metadata.service';
import { EntityMetadata } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { Repository } from 'typeorm';

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
    private readonly useMessageQueue: boolean;

    constructor(
        private readonly connection: Connection,
        private readonly configService: ConfigService,
        private readonly chatterMessageService: ChatterMessageService,
        private readonly modelMetadataService: ModelMetadataService,
        @InjectRepository(ModelMetadata)
        private readonly modelMetadataRepo: Repository<ModelMetadata>,
    ) {
        this.useMessageQueue = this.configService.get<boolean>('app-builder.audit.useMessageQueue', false);
        connection.subscribers.push(this);
    }

    private async shouldTrackAudit(entity: any, metadata: EntityMetadata): Promise<boolean> {
        // Get the model metadata for the entity using the table name
        const model = await this.modelMetadataRepo.findOne({
            where: {
                displayName: metadata.name
            },
            relations: {
                fields: true,
                module: true
            }
        });

        // If no model found or audit tracking is disabled at model level, return false
        if (!model || !model.enableAuditTracking) {
            return false;
        }

        // Get all fields that have audit tracking enabled
        const auditFields = model.fields.filter(field => 
            field.enableAuditTracking && 
            !['oneToMany', 'mediaSingle', 'mediaMultiple', 'computed', 'richText', 'json'].includes(field.type)
        );

        // If no fields have audit tracking enabled, return false
        if (auditFields.length === 0) {
            return false;
        }

        // Check if any of the audit-tracked fields have values in the entity
        return auditFields.some(field => {
            const fieldValue = entity[field.name];
            return fieldValue !== undefined && fieldValue !== null;
        });
    }

    async afterInsert(event: InsertEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            if (this.useMessageQueue) {
                // TODO: Implement message queue handling
                console.log('Message queue handling for audit not implemented yet');
            } else {
                await this.chatterMessageService.postAuditMessageOnInsert(event.entity, event.metadata);
            }
        }
    }

    async afterUpdate(event: UpdateEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            if (this.useMessageQueue) {
                // TODO: Implement message queue handling
                console.log('Message queue handling for audit not implemented yet');
            } else {
                await this.chatterMessageService.postAuditMessageOnUpdate(event.entity, event.metadata, event.databaseEntity);
            }
        }
    }

    async afterRemove(event: RemoveEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            if (this.useMessageQueue) {
                // TODO: Implement message queue handling
                console.log('Message queue handling for audit not implemented yet');
            } else {
                await this.chatterMessageService.postAuditMessageOnDelete(event.entity, event.metadata);
            }
        }
    }
} 