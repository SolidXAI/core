import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentRegistry } from 'src/entities/agent-registry.entity';
import { AgentSkill } from 'src/entities/agent-skill.entity';
import { AgentTool } from 'src/entities/agent-tool.entity';
import { AgentSecret } from 'src/entities/agent-secret.entity';
import { AgentRole } from 'src/entities/agent-role.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';

@Injectable()
export class AgentRegistrySubscriber implements EntitySubscriberInterface<AgentRegistry> {
    private readonly logger = new Logger(AgentRegistrySubscriber.name);
    private readonly previousAgents = new Map<number, { name: string; moduleName?: string }>();
    private readonly deletedAgents = new Map<number, { name: string; moduleName?: string }>();

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
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const agent = await this.getAgent(event.manager, event.entity?.id);
        if (agent && !agent.deletedAt) await this.writeAgent(agent);
    }

    async beforeUpdate(event: UpdateEvent<AgentRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const agent = await event.manager.getRepository(AgentRegistry).findOne({
            where: { id },
            relations: { module: true },
            withDeleted: true,
        });
        if (agent) this.previousAgents.set(id, { name: agent.name, moduleName: agent.module?.name });
    }

    async afterUpdate(event: UpdateEvent<AgentRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const previous = this.previousAgents.get(id);
        this.previousAgents.delete(id);

        const agent = await this.getAgent(event.manager, id);
        if (!agent) return;
        if (agent.deletedAt) {
            await this.removeAgent(agent.module?.name, agent.name);
            return;
        }
        await this.writeAgent(agent);

        if (previous && (previous.name !== agent.name || previous.moduleName !== agent.module?.name)) {
            await this.removeAgent(previous.moduleName, previous.name);
        }
    }

    async beforeRemove(event: RemoveEvent<AgentRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedAgent(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedAgent(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<AgentRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedAgent(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedAgent(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    private async getAgent(manager: EntityManager, id?: number): Promise<AgentRegistry | null> {
        if (!id) return null;
        return manager.getRepository(AgentRegistry).findOne({
            where: { id },
            relations: {
                module: true,
                tags: true,
                agentSkills: { agentSkillRegistry: true },
                agentTools: { agentToolRegistry: true },
                agentSecrets: { secret: true },
                agentRoles: { roleMetadata: true },
            },
            withDeleted: true,
        });
    }

    private async rememberDeletedAgent(manager: EntityManager, id?: number): Promise<void> {
        if (!id) return;
        const agent = await manager.getRepository(AgentRegistry).findOne({
            where: { id },
            relations: { module: true },
        });
        if (agent) this.deletedAgents.set(id, { name: agent.name, moduleName: agent.module?.name });
    }

    private async removeDeletedAgent(id?: number): Promise<void> {
        if (!id) return;
        const agent = this.deletedAgents.get(id);
        this.deletedAgents.delete(id);
        if (agent) await this.removeAgent(agent.moduleName, agent.name);
    }

    private async writeAgent(agent: AgentRegistry): Promise<void> {
        const moduleName = agent.module?.name;
        if (!moduleName) throw new Error(`Module not found for agent ${agent.name}`);
        if (moduleName === SOLID_CORE_MODULE_NAME) return;

        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        let metadata: any;
        try {
            this.logger.warn(`METADATA READ START pid=${process.pid} at=${Date.now()} path=${filePath}`);
            metadata = JSON.parse(await fs.readFile(filePath, 'utf8'));
            this.logger.warn(`METADATA READ END pid=${process.pid} at=${Date.now()} path=${filePath}`);
        } catch (error: any) {
            this.logger.error(`Failed to read module metadata at ${filePath}: ${error?.message ?? error}`);
            return;
        }
        const agents = Array.isArray(metadata.agenthubAgents) ? metadata.agenthubAgents : [];
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
            tags: (agent.tags ?? []).map((tag) => tag.name).sort(),
            agentSkills: this.getAgentSkills(agent.agentSkills ?? []),
            agentTools: this.getAgentTools(agent.agentTools ?? []),
            agentSecrets: this.getAgentSecrets(agent.agentSecrets ?? []),
            agentRoles: this.getAgentRoles(agent.agentRoles ?? []),
            moduleUserKey: moduleName,
        };
        if (index === -1) agents.push(entry);
        else agents[index] = entry;
        metadata.agenthubAgents = agents;
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }

    private async removeAgent(moduleName: string | undefined, name: string): Promise<void> {
        if (!moduleName || moduleName === SOLID_CORE_MODULE_NAME) return;
        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        let metadata: any;
        try {
            this.logger.warn(`METADATA READ START pid=${process.pid} at=${Date.now()} path=${filePath}`);
            metadata = JSON.parse(await fs.readFile(filePath, 'utf8'));
            this.logger.warn(`METADATA READ END pid=${process.pid} at=${Date.now()} path=${filePath}`);
        } catch (error: any) {
            this.logger.error(`Failed to read module metadata at ${filePath}: ${error?.message ?? error}`);
            return;
        }
        if (!Array.isArray(metadata.agenthubAgents)) return;
        const agents = metadata.agenthubAgents.filter((agent: { name?: string }) => agent.name !== name);
        if (agents.length === metadata.agenthubAgents.length) return;
        metadata.agenthubAgents = agents;
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }

    async writeAgentSkillsToMetadata(agentId: number, manager: EntityManager): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const links = await manager.getRepository(AgentSkill).find({
            where: { agentRegistry: { id: agentId } },
            relations: { agentSkillRegistry: true },
        });
        await this.writeAgentRelation(agentId, 'agentSkills', this.getAgentSkills(links), manager);
    }

    async writeAgentToolsToMetadata(agentId: number, manager: EntityManager): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const links = await manager.getRepository(AgentTool).find({
            where: { agentRegistry: { id: agentId } },
            relations: { agentToolRegistry: true },
        });
        await this.writeAgentRelation(agentId, 'agentTools', this.getAgentTools(links), manager);
    }

    async writeAgentSecretsToMetadata(agentId: number, manager: EntityManager): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const links = await manager.getRepository(AgentSecret).find({
            where: { agentRegistry: { id: agentId } },
            relations: { secret: true },
        });
        await this.writeAgentRelation(agentId, 'agentSecrets', this.getAgentSecrets(links), manager);
    }

    async writeAgentRolesToMetadata(agentId: number, manager: EntityManager): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const links = await manager.getRepository(AgentRole).find({
            where: { agentRegistry: { id: agentId } },
            relations: { roleMetadata: true },
        });
        await this.writeAgentRelation(agentId, 'agentRoles', this.getAgentRoles(links), manager);
    }

    private async writeAgentRelation(
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

        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(agent.module.name);
        let metadata: any;
        try {
            this.logger.warn(`METADATA READ START pid=${process.pid} at=${Date.now()} path=${filePath}`);
            metadata = JSON.parse(await fs.readFile(filePath, 'utf8'));
            this.logger.warn(`METADATA READ END pid=${process.pid} at=${Date.now()} path=${filePath}`);
        } catch (error: any) {
            this.logger.error(`Failed to read module metadata at ${filePath}: ${error?.message ?? error}`);
            return;
        }
        if (!Array.isArray(metadata.agenthubAgents)) return;
        const entry = metadata.agenthubAgents.find((item: { name: string }) => item.name === agent.name);
        if (!entry) return;
        entry[key] = links;
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }

    private getAgentSkills(links: AgentSkill[]) {
        return links
            .filter((link) => !link.deletedAt && link.agentSkillRegistry?.name)
            .map((link) => ({ name: link.agentSkillRegistry.name, alwaysInclude: link.alwaysInclude }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    private getAgentTools(links: AgentTool[]) {
        return links
            .filter((link) => !link.deletedAt && link.agentToolRegistry?.name)
            .map((link) => ({ name: link.agentToolRegistry.name, requiresApproval: link.requiresApproval }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    private getAgentSecrets(links: AgentSecret[]) {
        return links
            .filter((link) => !link.deletedAt && link.secret?.key)
            .map((link) => ({ key: link.secret.key, envVarName: link.envVarName }))
            .sort((a, b) => a.key.localeCompare(b.key));
    }

    private getAgentRoles(links: AgentRole[]) {
        return links
            .filter((link) => !link.deletedAt && link.roleMetadata?.name)
            .map((link) => ({ roleMetadataUserKey: link.roleMetadata.name, ...(link.agentRoleKey && { agentRoleKey: link.agentRoleKey }) }))
            .sort((a, b) => a.roleMetadataUserKey.localeCompare(b.roleMetadataUserKey));
    }
}
