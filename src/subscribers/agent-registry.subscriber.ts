import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentRegistry } from 'src/entities/agent-registry.entity';
import { AgentSkill } from 'src/entities/agent-skill.entity';
import { AgentTool } from 'src/entities/agent-tool.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { getRemoveEntityId, updateModuleMetadataJson } from './agenthub-metadata-sync.util';

type AgentDeletion = { name: string; moduleName?: string };

@Injectable()
export class AgentRegistrySubscriber implements EntitySubscriberInterface<AgentRegistry> {
    private readonly logger = new Logger(AgentRegistrySubscriber.name);
    private readonly removals = new Map<number, AgentDeletion>();

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

    async beforeRemove(event: RemoveEvent<AgentRegistry>): Promise<void> {
        const id = getRemoveEntityId(event);
        if (!id) return;
        const agent = await event.manager.getRepository(AgentRegistry).findOne({
            where: { id },
            relations: { module: true },
        });
        if (agent) this.removals.set(id, { name: agent.name, moduleName: agent.module?.name });
    }

    async afterRemove(event: RemoveEvent<AgentRegistry>): Promise<void> {
        const id = getRemoveEntityId(event);
        const deletion = id ? this.removals.get(id) : undefined;
        if (id) this.removals.delete(id);
        if (!deletion) return;

        await updateModuleMetadataJson(deletion.moduleName, this.moduleMetadataHelperService, this.logger, (metadata) => {
            if (!Array.isArray(metadata.agenthubAgents)) return false;
            const agents = metadata.agenthubAgents.filter((agent: { name?: string }) => agent.name !== deletion.name);
            if (agents.length === metadata.agenthubAgents.length) return false;
            metadata.agenthubAgents = agents;
            return true;
        });
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentRegistry>): Promise<void> {
        await this.beforeRemove(event as RemoveEvent<AgentRegistry>);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentRegistry>): Promise<void> {
        await this.afterRemove(event as RemoveEvent<AgentRegistry>);
    }

    private async syncMetadata(event: InsertEvent<AgentRegistry> | UpdateEvent<AgentRegistry>): Promise<void> {
        if (!event.entity?.id) return;
        const agent = await event.manager.getRepository(AgentRegistry).findOne({
            where: { id: event.entity.id },
            relations: {
                module: true,
                tags: true,
                agentSkills: { agentSkillRegistry: true },
                agentTools: { agentToolRegistry: true },
            },
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
        const existingEntry = index === -1 ? {} : agents[index];
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
            tags: agent.tags.map((tag) => tag.name).sort(),
            ...(agent.agentSkills && { agentSkills: this.getAgentSkills(agent.agentSkills) }),
            ...(agent.agentTools && { agentTools: this.getAgentTools(agent.agentTools) }),
            moduleUserKey: moduleName,
        };
        if (index === -1) agents.push(entry);
        else agents[index] = entry;
        metadata.agenthubAgents = agents;
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }

    async syncAgentSkills(agentId: number, manager: EntityManager): Promise<void> {
        const links = await manager.getRepository(AgentSkill).find({
            where: { agentRegistry: { id: agentId } },
            relations: { agentSkillRegistry: true },
        });
        await this.syncAgentRelation(agentId, 'agentSkills', this.getAgentSkills(links), manager);
    }

    async syncAgentTools(agentId: number, manager: EntityManager): Promise<void> {
        const links = await manager.getRepository(AgentTool).find({
            where: { agentRegistry: { id: agentId } },
            relations: { agentToolRegistry: true },
        });
        await this.syncAgentRelation(agentId, 'agentTools', this.getAgentTools(links), manager);
    }

    private async syncAgentRelation(
        agentId: number,
        key: 'agentSkills' | 'agentTools',
        links: Array<{ name: string; alwaysInclude?: boolean; requiresApproval?: boolean }>,
        manager: EntityManager,
    ): Promise<void> {
        const agent = await manager.getRepository(AgentRegistry).findOne({
            where: { id: agentId },
            relations: { module: true },
        });
        if (!agent?.module?.name || agent.module.name === SOLID_CORE_MODULE_NAME) return;

        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(agent.module.name);
        try {
            await fs.access(filePath);
        } catch {
            this.logger.error(`Module metadata file not found: ${filePath}`);
            return;
        }
        const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
        if (!metadata) throw new Error(`Module metadata could not be read: ${filePath}`);
        const agents = metadata.agenthubAgents ?? [];
        const entry = agents.find((item: { name: string }) => item.name === agent.name);
        if (!entry) return;
        entry[key] = links;
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }

    private getAgentSkills(links: AgentSkill[]) {
        return links
            .filter((link) => link.agentSkillRegistry?.name)
            .map((link) => ({ name: link.agentSkillRegistry.name, alwaysInclude: link.alwaysInclude }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    private getAgentTools(links: AgentTool[]) {
        return links
            .filter((link) => link.agentToolRegistry?.name)
            .map((link) => ({ name: link.agentToolRegistry.name, requiresApproval: link.requiresApproval }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}
