import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentHubTag } from 'src/entities/agent-hub-tag.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { updateModuleMetadataJson } from './agenthub-metadata-sync.util';

@Injectable()
export class AgentHubTagSubscriber implements EntitySubscriberInterface<AgentHubTag> {
    private readonly logger = new Logger(AgentHubTagSubscriber.name);

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentHubTag;
    }

    async afterInsert(event: InsertEvent<AgentHubTag>): Promise<void> {
        await this.syncMetadata(event);
    }

    async afterUpdate(event: UpdateEvent<AgentHubTag>): Promise<void> {
        await this.syncMetadata(event);
    }

    private async syncMetadata(event: InsertEvent<AgentHubTag> | UpdateEvent<AgentHubTag>): Promise<void> {
        if (!event.entity?.id) return;
        const tag = await event.manager.getRepository(AgentHubTag).findOne({
            where: { id: event.entity.id },
            relations: { module: true },
        });
        if (!tag) throw new Error(`AgentHub tag not found for id ${event.entity.id}`);
        const moduleName = tag.module?.name;
        if (!moduleName) throw new Error(`Module not found for tag ${tag.name}`);
        if (moduleName === SOLID_CORE_MODULE_NAME) return;

        await updateModuleMetadataJson(moduleName, this.moduleMetadataHelperService, this.logger, (metadata) => {
            const tags = metadata.agenthubTags ?? [];
            const index = tags.findIndex((item: { name: string }) => item.name === tag.name);
            const entry = { name: tag.name, moduleUserKey: moduleName };
            if (index === -1) tags.push(entry);
            else tags[index] = entry;
            metadata.agenthubTags = tags;
            return true;
        });
    }
}
