import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentRegistry } from 'src/entities/agent-registry.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';

@Injectable()
export class AgentRegistrySubscriber implements EntitySubscriberInterface<AgentRegistry> {
    private readonly logger = new Logger(AgentRegistrySubscriber.name);

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentRegistry;
    }

    async afterInsert(event: InsertEvent<AgentRegistry>): Promise<void> {
        await this.syncMetadata(event);
    }

    async afterUpdate(event: UpdateEvent<AgentRegistry>): Promise<void> {
        await this.syncMetadata(event);
    }

    private async syncMetadata(event: InsertEvent<AgentRegistry> | UpdateEvent<AgentRegistry>): Promise<void> {
        if (!event.entity?.id) return;
        const agent = await event.manager.getRepository(AgentRegistry).findOne({
            where: { id: event.entity.id },
            relations: { module: true },
        });
        if (!agent) throw new Error(`Agent registry record not found for id ${event.entity.id}`);
        const moduleName = agent.module?.name;
        if (!moduleName) throw new Error(`Module not found for agent ${agent.name}`);
        if (moduleName === SOLID_CORE_MODULE_NAME) return;

        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        try {
            await fs.access(filePath);
        } catch {
            this.logger.error(`Module metadata file not found: ${filePath}`);
            return;
        }
        const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
        if (!metadata) throw new Error(`Module metadata could not be read: ${filePath}`);

        const agents = metadata.agenthubAgents ?? [];
        const index = agents.findIndex((item: { name: string }) => item.name === agent.name);
        const { tags, ...existingEntry } = index === -1 ? {} : agents[index];
        const entry = {
            ...existingEntry,
            name: agent.name,
            title: agent.title,
            description: agent.description,
            iconName: agent.iconName,
            systemPrompt: agent.systemPrompt,
            requiredInputs: agent.requiredInputs,
            reasoningModelKey: agent.reasoningModelKey,
            fastModelKey: agent.fastModelKey,
            status: agent.status,
            stepLimit: agent.stepLimit,
            turnStepLimit: agent.turnStepLimit,
            costLimit: Number(agent.costLimit),
            moduleUserKey: moduleName,
        };
        if (index === -1) agents.push(entry);
        else agents[index] = entry;
        metadata.agenthubAgents = agents;
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
}
