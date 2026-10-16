import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentSkillRegistry } from 'src/entities/agent-skill-registry.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { AgentSkill } from 'src/entities/agent-skill.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentSkillRegistrySubscriber implements EntitySubscriberInterface<AgentSkillRegistry> {
    private readonly logger = new Logger(AgentSkillRegistrySubscriber.name);
    private readonly previousSkills = new Map<number, { name: string; moduleName?: string }>();
    private readonly deletedSkills = new Map<number, { name: string; moduleName?: string; agentIds: number[] }>();

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        private readonly agentRegistrySubscriber: AgentRegistrySubscriber,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentSkillRegistry;
    }

    async afterInsert(event: InsertEvent<AgentSkillRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const skill = await this.getSkill(event.manager, event.entity?.id);
        if (skill && !skill.deletedAt) await this.writeSkill(skill);
    }

    async beforeUpdate(event: UpdateEvent<AgentSkillRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const skill = await event.manager.getRepository(AgentSkillRegistry).findOne({
            where: { id },
            relations: { module: true },
            withDeleted: true,
        });
        if (skill) this.previousSkills.set(id, { name: skill.name, moduleName: skill.module?.name });
    }

    async afterUpdate(event: UpdateEvent<AgentSkillRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const previous = this.previousSkills.get(id);
        this.previousSkills.delete(id);

        const skill = await this.getSkill(event.manager, id);
        if (!skill) return;
        if (skill.deletedAt) {
            await this.removeSkill(skill.module?.name, skill.name);
            return;
        }
        await this.writeSkill(skill);

        if (previous && (previous.name !== skill.name || previous.moduleName !== skill.module?.name)) {
            await this.removeSkill(previous.moduleName, previous.name);
        }
    }

    async beforeRemove(event: RemoveEvent<AgentSkillRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedSkill(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentSkillRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedSkill(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<AgentSkillRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedSkill(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentSkillRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedSkill(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    private async getSkill(manager: EntityManager, id?: number): Promise<AgentSkillRegistry | null> {
        if (!id) return null;
        return manager.getRepository(AgentSkillRegistry).findOne({
            where: { id },
            relations: { module: true, tags: true },
            withDeleted: true,
        });
    }

    private async rememberDeletedSkill(manager: EntityManager, id?: number): Promise<void> {
        if (!id) return;
        const skill = await manager.getRepository(AgentSkillRegistry).findOne({
            where: { id },
            relations: { module: true },
        });
        if (!skill) return;

        // --- Agent links: capture linked agents now; the DB cascade removes these links on delete ---
        const links = await manager.getRepository(AgentSkill).find({
            where: { agentSkillRegistry: { id } },
            relations: { agentRegistry: true },
        });
        this.deletedSkills.set(id, {
            name: skill.name,
            moduleName: skill.module?.name,
            agentIds: links.map((link) => link.agentRegistry.id),
        });
    }

    private async removeDeletedSkill(id: number | undefined, manager: EntityManager): Promise<void> {
        if (!id) return;
        const skill = this.deletedSkills.get(id);
        this.deletedSkills.delete(id);
        if (!skill) return;

        // --- Skill update: remove the skill entry ---
        await this.removeSkill(skill.moduleName, skill.name);

        // --- Agent update: rewrite the skill list of every agent that used it (one at a time) ---
        for (const agentId of skill.agentIds) {
            await this.agentRegistrySubscriber.writeAgentSkillsToMetadata(agentId, manager);
        }
    }

    private async writeSkill(skill: AgentSkillRegistry): Promise<void> {
        const moduleName = skill.module?.name;
        if (!moduleName) throw new Error(`Module not found for skill ${skill.name}`);
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
        const skills = Array.isArray(metadata.agenthubSkills) ? metadata.agenthubSkills : [];
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
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }

    private async removeSkill(moduleName: string | undefined, name: string): Promise<void> {
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
        if (!Array.isArray(metadata.agenthubSkills)) return;
        const skills = metadata.agenthubSkills.filter((skill: { name?: string }) => skill.name !== name);
        if (skills.length === metadata.agenthubSkills.length) return;
        metadata.agenthubSkills = skills;
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }
}
