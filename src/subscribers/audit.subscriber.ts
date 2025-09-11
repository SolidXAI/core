import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityMetadata, EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, Repository, UpdateEvent } from 'typeorm';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { ChatterMessageService } from '../services/chatter-message.service';
import { lowerFirst } from 'src/helpers/string.helper';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';

@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly chatterMessageService: ChatterMessageService,
        @InjectRepository(ModelMetadata)
        private readonly modelMetadataRepo: Repository<ModelMetadata>,
        private readonly modelMetadataHelperService : ModelMetadataHelperService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    private async shouldTrackAudit(entity: any, metadata: EntityMetadata): Promise<boolean> {
        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: lowerFirst(metadata.name)
            },
            relations: {
                fields: true,
                module: true
            }
        });

        if (!model || !model.enableAuditTracking) {
            return false;
        }

        const modelFields = await this.modelMetadataHelperService.loadFieldHierarchy(model.singularName)

        const auditFields = modelFields.filter(field =>
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
            await this.chatterMessageService.postAuditMessageOnUpdate(event.entity, event.metadata, event.databaseEntity, event.updatedColumns || []);
        }
    }

    async afterRemove(event: RemoveEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            await this.chatterMessageService.postAuditMessageOnDelete(event.entity, event.metadata, event.databaseEntity);
        }
    }
} 