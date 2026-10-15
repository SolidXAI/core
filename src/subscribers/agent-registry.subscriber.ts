import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentRegistry } from 'src/entities/agent-registry.entity';
import { AgentSkill } from 'src/entities/agent-skill.entity';
import { AgentTool } from 'src/entities/agent-tool.entity';
import { AgentSecret } from 'src/entities/agent-secret.entity';
import { AgentRole } from 'src/entities/agent-role.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { updateModuleMetadataJson } from './agenthub-metadata-sync.util';

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
            relations: {
                module: true,
                tags: true,
                agentSkills: { agentSkillRegistry: true },
                agentTools: { agentToolRegistry: true },
                agentSecrets: { secret: true },
                agentRoles: { roleMetadata: true },
            },
        });
        if (!agent) throw new Error(`Agent registry record not found for id ${event.entity.id}`);
        const moduleName = agent.module?.name;
        if (!moduleName) throw new Error(`Module not found for agent ${agent.name}`);
        if (moduleName === SOLID_CORE_MODULE_NAME) return;

        await updateModuleMetadataJson(moduleName, this.moduleMetadataHelperService, this.logger, (metadata) => {
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
                ...(agent.agentSecrets && { agentSecrets: this.getAgentSecrets(agent.agentSecrets) }),
                ...(agent.agentRoles && { agentRoles: this.getAgentRoles(agent.agentRoles) }),
                moduleUserKey: moduleName,
            };
            if (index === -1) agents.push(entry);
            else agents[index] = entry;
            metadata.agenthubAgents = agents;
            return true;
        });
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

    async syncAgentSecrets(agentId: number, manager: EntityManager): Promise<void> {
        const links = await manager.getRepository(AgentSecret).find({
            where: { agentRegistry: { id: agentId } },
            relations: { secret: true },
        });
        await this.syncAgentRelation(agentId, 'agentSecrets', this.getAgentSecrets(links), manager);
    }

    async syncAgentRoles(agentId: number, manager: EntityManager): Promise<void> {
        const links = await manager.getRepository(AgentRole).find({
            where: { agentRegistry: { id: agentId } },
            relations: { roleMetadata: true },
        });
        await this.syncAgentRelation(agentId, 'agentRoles', this.getAgentRoles(links), manager);
    }

    private async syncAgentRelation(
        agentId: number,
        key: 'agentSkills' | 'agentTools' | 'agentSecrets' | 'agentRoles',
        links: Array<{ name?: string; key?: string; roleMetadataUserKey?: string; agentRoleKey?: string; alwaysInclude?: boolean; requiresApproval?: boolean; envVarName?: string }>,
        manager: EntityManager,
    ): Promise<void> {
        const agent = await manager.getRepository(AgentRegistry).findOne({
            where: { id: agentId },
            relations: { module: true },
        });
        if (!agent?.module?.name || agent.module.name === SOLID_CORE_MODULE_NAME) return;

        await updateModuleMetadataJson(agent.module.name, this.moduleMetadataHelperService, this.logger, (metadata) => {
            const agents = metadata.agenthubAgents ?? [];
            const entry = agents.find((item: { name: string }) => item.name === agent.name);
            if (!entry) return false;
            entry[key] = links;
            metadata.agenthubAgents = agents;
            return true;
        });
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

    private getAgentSecrets(links: AgentSecret[]) {
        return links
            .filter((link) => link.secret?.key)
            .map((link) => ({ key: link.secret.key, envVarName: link.envVarName }))
            .sort((a, b) => a.key.localeCompare(b.key));
    }

    private getAgentRoles(links: AgentRole[]) {
        return links
            .filter((link) => link.roleMetadata?.name)
            .map((link) => ({ roleMetadataUserKey: link.roleMetadata.name, ...(link.agentRoleKey && { agentRoleKey: link.agentRoleKey }) }))
            .sort((a, b) => a.roleMetadataUserKey.localeCompare(b.roleMetadataUserKey));
    }
}
