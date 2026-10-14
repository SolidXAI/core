import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentTool } from 'src/entities/agent-tool.entity';
import { AgentToolRegistry } from 'src/entities/agent-tool-registry.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { getRemoveEntityId, updateModuleMetadataJson } from './agenthub-metadata-sync.util';

type ToolDeletion = { name: string; moduleName?: string; agents: Array<{ name: string; moduleName?: string }> };

@Injectable()
export class AgentToolRegistrySubscriber implements EntitySubscriberInterface<AgentToolRegistry> {
    private readonly logger = new Logger(AgentToolRegistrySubscriber.name);
    private readonly removals = new Map<number, ToolDeletion>();

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

    async beforeRemove(event: RemoveEvent<AgentToolRegistry>): Promise<void> {
        const id = getRemoveEntityId(event);
        if (!id) return;
        const tool = await event.manager.getRepository(AgentToolRegistry).findOne({
            where: { id },
            relations: { module: true },
        });
        if (!tool) return;
        const links = await event.manager.getRepository(AgentTool).find({
            where: { agentToolRegistry: { id } },
            relations: { agentRegistry: { module: true } },
        });
        this.removals.set(id, {
            name: tool.name,
            moduleName: tool.module?.name,
            agents: links.map(({ agentRegistry }) => ({
                name: agentRegistry?.name,
                moduleName: agentRegistry?.module?.name,
            })).filter((agent): agent is { name: string; moduleName: string } => Boolean(agent.name)),
        });
    }

    async afterRemove(event: RemoveEvent<AgentToolRegistry>): Promise<void> {
        const id = getRemoveEntityId(event);
        const deletion = id ? this.removals.get(id) : undefined;
        if (id) this.removals.delete(id);
        if (!deletion) return;

        const modules = new Set<string>();
        const agentsByModule = new Map<string, Set<string>>();
        if (deletion.moduleName) modules.add(deletion.moduleName);
        for (const agent of deletion.agents) {
            if (!agent.moduleName) continue;
            modules.add(agent.moduleName);
            const agents = agentsByModule.get(agent.moduleName) ?? new Set<string>();
            agents.add(agent.name);
            agentsByModule.set(agent.moduleName, agents);
        }
        for (const moduleName of modules) {
            await updateModuleMetadataJson(moduleName, this.moduleMetadataHelperService, this.logger, (metadata) => {
                let changed = false;
                if (moduleName === deletion.moduleName && Array.isArray(metadata.agenthubTools)) {
                    const tools = metadata.agenthubTools.filter((tool: { name?: string }) => tool.name !== deletion.name);
                    changed ||= tools.length !== metadata.agenthubTools.length;
                    metadata.agenthubTools = tools;
                }
                if (Array.isArray(metadata.agenthubAgents)) {
                    for (const agent of metadata.agenthubAgents) {
                        if (!agentsByModule.get(moduleName)?.has(agent.name)) continue;
                        const tools = Array.isArray(agent.agentTools) ? agent.agentTools : [];
                        const nextTools = tools.filter((tool: { name?: string }) => tool.name !== deletion.name);
                        if (nextTools.length !== tools.length) {
                            agent.agentTools = nextTools;
                            changed = true;
                        }
                    }
                }
                return changed;
            });
        }
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentToolRegistry>): Promise<void> {
        await this.beforeRemove(event as RemoveEvent<AgentToolRegistry>);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentToolRegistry>): Promise<void> {
        await this.afterRemove(event as RemoveEvent<AgentToolRegistry>);
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

        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        try {
            await fs.access(filePath);
        } catch {
            this.logger.error(`Module metadata file not found: ${filePath}`);
            return;
        }
        const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
        if (!metadata) throw new Error(`Module metadata could not be read: ${filePath}`);

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
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
}
