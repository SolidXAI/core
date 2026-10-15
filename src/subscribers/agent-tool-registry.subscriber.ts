import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentToolRegistry } from 'src/entities/agent-tool-registry.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { updateModuleMetadataJson } from './agenthub-metadata-sync.util';

@Injectable()
export class AgentToolRegistrySubscriber implements EntitySubscriberInterface<AgentToolRegistry> {
    private readonly logger = new Logger(AgentToolRegistrySubscriber.name);

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentToolRegistry;
    }

    async afterInsert(event: InsertEvent<AgentToolRegistry>): Promise<void> {
        await this.syncMetadata(event);
    }

    async afterUpdate(event: UpdateEvent<AgentToolRegistry>): Promise<void> {
        await this.syncMetadata(event);
    }

    private async syncMetadata(event: InsertEvent<AgentToolRegistry> | UpdateEvent<AgentToolRegistry>): Promise<void> {
        if (!event.entity?.id) return;
        const tool = await event.manager.getRepository(AgentToolRegistry).findOne({
            where: { id: event.entity.id },
            relations: { module: true, tags: true },
        });
        if (!tool) throw new Error(`Agent tool registry record not found for id ${event.entity.id}`);
        const moduleName = tool.module?.name;
        if (!moduleName) throw new Error(`Module not found for tool ${tool.name}`);
        if (moduleName === SOLID_CORE_MODULE_NAME) return;

        await updateModuleMetadataJson(moduleName, this.moduleMetadataHelperService, this.logger, (metadata) => {
            const tools = metadata.agenthubTools ?? [];
            const index = tools.findIndex((item: { name: string }) => item.name === tool.name);
            const entry = {
                name: tool.name,
                type: tool.type,
                iconName: tool.iconName,
                description: tool.description,
                sourceCode: tool.sourceCode,
                checksum: tool.checksum,
                status: tool.status,
                tags: tool.tags.map((tag) => tag.name).sort(),
                moduleUserKey: moduleName,
            };
            if (index === -1) tools.push(entry);
            else tools[index] = entry;
            metadata.agenthubTools = tools;
            return true;
        });
    }
}
