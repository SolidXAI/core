import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentSkill } from 'src/entities/agent-skill.entity';
import { AgentSkillRegistry } from 'src/entities/agent-skill-registry.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { getRemoveEntityId, updateModuleMetadataJson } from './agenthub-metadata-sync.util';

type SkillDeletion = { name: string; moduleName?: string; agents: Array<{ name: string; moduleName?: string }> };

@Injectable()
export class AgentSkillRegistrySubscriber implements EntitySubscriberInterface<AgentSkillRegistry> {
    private readonly logger = new Logger(AgentSkillRegistrySubscriber.name);
    private readonly removals = new Map<number, SkillDeletion>();

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentSkillRegistry;
    }

    async afterInsert(event: InsertEvent<AgentSkillRegistry>): Promise<void> {
        await this.syncMetadata(event);
    }

    async afterUpdate(event: UpdateEvent<AgentSkillRegistry>): Promise<void> {
        await this.syncMetadata(event);
    }

    async beforeRemove(event: RemoveEvent<AgentSkillRegistry>): Promise<void> {
        const id = getRemoveEntityId(event);
        if (!id) return;
        const skill = await event.manager.getRepository(AgentSkillRegistry).findOne({
            where: { id },
            relations: { module: true },
        });
        if (!skill) return;
        const links = await event.manager.getRepository(AgentSkill).find({
            where: { agentSkillRegistry: { id } },
            relations: { agentRegistry: { module: true } },
        });
        this.removals.set(id, {
            name: skill.name,
            moduleName: skill.module?.name,
            agents: links.map(({ agentRegistry }) => ({
                name: agentRegistry?.name,
                moduleName: agentRegistry?.module?.name,
            })).filter((agent): agent is { name: string; moduleName: string } => Boolean(agent.name)),
        });
    }

    async afterRemove(event: RemoveEvent<AgentSkillRegistry>): Promise<void> {
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
                if (moduleName === deletion.moduleName && Array.isArray(metadata.agenthubSkills)) {
                    const skills = metadata.agenthubSkills.filter((skill: { name?: string }) => skill.name !== deletion.name);
                    changed ||= skills.length !== metadata.agenthubSkills.length;
                    metadata.agenthubSkills = skills;
                }
                if (Array.isArray(metadata.agenthubAgents)) {
                    for (const agent of metadata.agenthubAgents) {
                        if (!agentsByModule.get(moduleName)?.has(agent.name)) continue;
                        const skills = Array.isArray(agent.agentSkills) ? agent.agentSkills : [];
                        const nextSkills = skills.filter((skill: { name?: string }) => skill.name !== deletion.name);
                        if (nextSkills.length !== skills.length) {
                            agent.agentSkills = nextSkills;
                            changed = true;
                        }
                    }
                }
                return changed;
            });
        }
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentSkillRegistry>): Promise<void> {
        await this.beforeRemove(event as RemoveEvent<AgentSkillRegistry>);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentSkillRegistry>): Promise<void> {
        await this.afterRemove(event as RemoveEvent<AgentSkillRegistry>);
    }

    private async syncMetadata(event: InsertEvent<AgentSkillRegistry> | UpdateEvent<AgentSkillRegistry>): Promise<void> {
        if (!event.entity?.id) return;
        const skill = await event.manager.getRepository(AgentSkillRegistry).findOne({
            where: { id: event.entity.id },
            relations: { module: true, tags: true },
        });
        if (!skill) throw new Error(`Agent skill registry record not found for id ${event.entity.id}`);
        const moduleName = skill.module?.name;
        if (!moduleName) throw new Error(`Module not found for skill ${skill.name}`);
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

        const skills = metadata.agenthubSkills ?? [];
        const index = skills.findIndex((item: { name: string }) => item.name === skill.name);
        const entry = {
            name: skill.name,
            type: skill.type,
            iconName: skill.iconName,
            description: skill.description,
            body: skill.body,
            tags: skill.tags.map((tag) => tag.name).sort(),
            moduleUserKey: moduleName,
        };
        if (index === -1) skills.push(entry);
        else skills[index] = entry;
        metadata.agenthubSkills = skills;
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
}
