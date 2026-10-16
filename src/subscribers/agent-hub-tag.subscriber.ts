import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentHubTag } from 'src/entities/agent-hub-tag.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';

@Injectable()
export class AgentHubTagSubscriber implements EntitySubscriberInterface<AgentHubTag> {
    private readonly logger = new Logger(AgentHubTagSubscriber.name);
    private readonly previousTags = new Map<number, { name: string; moduleName?: string }>();
    private readonly deletedTags = new Map<number, { name: string; moduleName?: string }>();

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
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const tag = await this.getTag(event.manager, event.entity?.id);
        if (tag) await this.writeTag(tag);
    }

    // Update hooks disabled: saving an agent/skill/tool cascades an update to each linked tag
    // (cascade: ['insert', 'update']), so these ran in parallel with the owner's metadata write
    // and corrupted the module metadata JSON. Tags are never renamed (delete + create instead),
    // so insert/remove hooks are enough to keep agenthubTags in sync.
    //
    // async beforeUpdate(event: UpdateEvent<AgentHubTag>): Promise<void> {
    //     const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
    //     if (solidCliRunning === "true") {
    //         return;
    //     }
    //
    //     const id = event.entity?.id ?? event.databaseEntity?.id;
    //     if (!id) return;
    //     const tag = await event.manager.getRepository(AgentHubTag).findOne({
    //         where: { id },
    //         relations: { module: true },
    //         withDeleted: true,
    //     });
    //     if (tag) this.previousTags.set(id, { name: tag.name, moduleName: tag.module?.name });
    // }
    //
    // async afterUpdate(event: UpdateEvent<AgentHubTag>): Promise<void> {
    //     const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
    //     if (solidCliRunning === "true") {
    //         return;
    //     }
    //
    //     const id = event.entity?.id ?? event.databaseEntity?.id;
    //     if (!id) return;
    //     const previous = this.previousTags.get(id);
    //     this.previousTags.delete(id);
    //
    //     const tag = await this.getTag(event.manager, id);
    //     if (!tag) return;
    //     if (tag.deletedAt) {
    //         await this.removeTag(tag.module?.name, tag.name);
    //         return;
    //     }
    //     await this.writeTag(tag);
    //
    //     if (previous && (previous.name !== tag.name || previous.moduleName !== tag.module?.name)) {
    //         await this.removeTag(previous.moduleName, previous.name);
    //     }
    // }

    async beforeRemove(event: RemoveEvent<AgentHubTag>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedTag(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentHubTag>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedTag(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<AgentHubTag>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedTag(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentHubTag>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedTag(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    private async getTag(manager: InsertEvent<AgentHubTag>['manager'], id?: number): Promise<AgentHubTag | null> {
        if (!id) return null;
        const tag = await manager.getRepository(AgentHubTag).findOne({
            where: { id },
            relations: { module: true },
            withDeleted: true,
        });
        if (!tag) throw new Error(`AgentHub tag not found for id ${id}`);
        return tag;
    }

    private async rememberDeletedTag(manager: InsertEvent<AgentHubTag>['manager'], id?: number): Promise<void> {
        if (!id) return;
        const tag = await manager.getRepository(AgentHubTag).findOne({
            where: { id },
            relations: { module: true },
        });
        if (tag) this.deletedTags.set(id, { name: tag.name, moduleName: tag.module?.name });
    }

    private async removeDeletedTag(id?: number): Promise<void> {
        if (!id) return;
        const tag = this.deletedTags.get(id);
        this.deletedTags.delete(id);
        if (tag) await this.removeTag(tag.moduleName, tag.name);
    }

    private async writeTag(tag: AgentHubTag): Promise<void> {
        const moduleName = tag.module?.name;
        if (!moduleName) throw new Error(`Module not found for tag ${tag.name}`);
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
        const tags = Array.isArray(metadata.agenthubTags) ? metadata.agenthubTags : [];
        const index = tags.findIndex((item: { name: string }) => item.name === tag.name);
        const entry = { name: tag.name, moduleUserKey: moduleName };
        if (index === -1) tags.push(entry);
        else tags[index] = entry;
        metadata.agenthubTags = tags;
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }

    private async removeTag(moduleName: string | undefined, name: string): Promise<void> {
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

        // --- Tag update: remove the tag entry ---
        if (!Array.isArray(metadata.agenthubTags)) return;
        const tags = metadata.agenthubTags.filter((tag: { name?: string }) => tag.name !== name);
        if (tags.length === metadata.agenthubTags.length) return;
        metadata.agenthubTags = tags;

        // Agents, skills and tools reference tags by name, so the deleted tag is removed from them in this same write.

        // --- Agent update: remove the tag from every agent's tags ---
        for (const agent of Array.isArray(metadata.agenthubAgents) ? metadata.agenthubAgents : []) {
            if (Array.isArray(agent.tags)) agent.tags = agent.tags.filter((tagName: string) => tagName !== name);
        }

        // --- Skill update: remove the tag from every skill's tags ---
        for (const skill of Array.isArray(metadata.agenthubSkills) ? metadata.agenthubSkills : []) {
            if (Array.isArray(skill.tags)) skill.tags = skill.tags.filter((tagName: string) => tagName !== name);
        }

        // --- Tool update: remove the tag from every tool's tags ---
        for (const tool of Array.isArray(metadata.agenthubTools) ? metadata.agenthubTools : []) {
            if (Array.isArray(tool.tags)) tool.tags = tool.tags.filter((tagName: string) => tagName !== name);
        }

        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }
}
