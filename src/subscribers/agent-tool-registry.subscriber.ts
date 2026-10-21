import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentToolRegistry } from 'src/entities/agent-tool-registry.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { AgentTool } from 'src/entities/agent-tool.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentToolRegistrySubscriber implements EntitySubscriberInterface<AgentToolRegistry> {
    private readonly logger = new Logger(AgentToolRegistrySubscriber.name);
    private readonly previousTools = new Map<number, { name: string; moduleName?: string }>();
    private readonly deletedTools = new Map<number, { name: string; moduleName?: string; agentIds: number[] }>();

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        private readonly agentRegistrySubscriber: AgentRegistrySubscriber,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentToolRegistry;
    }

    async afterInsert(event: InsertEvent<AgentToolRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const tool = await this.getTool(event.manager, event.entity?.id);
        if (tool && !tool.deletedAt) await this.writeTool(tool);
    }

    async beforeUpdate(event: UpdateEvent<AgentToolRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const tool = await event.manager.getRepository(AgentToolRegistry).findOne({
            where: { id },
            relations: { module: true },
            withDeleted: true,
        });
        if (tool) this.previousTools.set(id, { name: tool.name, moduleName: tool.module?.name });
    }

    async afterUpdate(event: UpdateEvent<AgentToolRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const previous = this.previousTools.get(id);
        this.previousTools.delete(id);

        const tool = await this.getTool(event.manager, id);
        if (!tool) return;
        if (tool.deletedAt) {
            await this.removeTool(tool.module?.name, tool.name);
            return;
        }
        await this.writeTool(tool);

        if (previous && (previous.name !== tool.name || previous.moduleName !== tool.module?.name)) {
            await this.removeTool(previous.moduleName, previous.name);
        }
    }

    async beforeRemove(event: RemoveEvent<AgentToolRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedTool(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentToolRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedTool(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<AgentToolRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedTool(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentToolRegistry>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedTool(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    private async getTool(manager: EntityManager, id?: number): Promise<AgentToolRegistry | null> {
        if (!id) return null;
        return manager.getRepository(AgentToolRegistry).findOne({
            where: { id },
            relations: { module: true, tags: true },
            withDeleted: true,
        });
    }

    private async rememberDeletedTool(manager: EntityManager, id?: number): Promise<void> {
        if (!id) return;
        const tool = await manager.getRepository(AgentToolRegistry).findOne({
            where: { id },
            relations: { module: true },
        });
        if (!tool) return;

        // --- Agent links: capture linked agents now; the DB cascade removes these links on delete ---
        const links = await manager.getRepository(AgentTool).find({
            where: { agentToolRegistry: { id } },
            relations: { agentRegistry: true },
        });
        this.deletedTools.set(id, {
            name: tool.name,
            moduleName: tool.module?.name,
            agentIds: links.map((link) => link.agentRegistry.id),
        });
    }

    private async removeDeletedTool(id: number | undefined, manager: EntityManager): Promise<void> {
        if (!id) return;
        const tool = this.deletedTools.get(id);
        this.deletedTools.delete(id);
        if (!tool) return;

        // --- Tool update: remove the tool entry ---
        await this.removeTool(tool.moduleName, tool.name);

        // --- Agent update: rewrite the tool list of every agent that used it (one at a time) ---
        for (const agentId of tool.agentIds) {
            await this.agentRegistrySubscriber.writeAgentToolsToMetadata(agentId, manager);
        }
    }

    private async writeTool(tool: AgentToolRegistry): Promise<void> {
        const moduleName = tool.module?.name;
        if (!moduleName) throw new Error(`Module not found for tool ${tool.name}`);
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
        const tools = Array.isArray(metadata.agenthubTools) ? metadata.agenthubTools : [];
        const index = tools.findIndex((item: { name: string }) => item.name === tool.name);
        const entry = {
            name: tool.name,
            type: tool.type,
            iconName: tool.iconName,
            description: tool.description,
            sourceCode: tool.sourceCode,
            checksum: tool.checksum,
            status: tool.status,
            tags: (tool.tags ?? []).map((tag) => tag.name).sort(),
            moduleUserKey: moduleName,
        };
        if (index === -1) tools.push(entry);
        else tools[index] = entry;
        metadata.agenthubTools = tools;
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }

    private async removeTool(moduleName: string | undefined, name: string): Promise<void> {
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
        if (!Array.isArray(metadata.agenthubTools)) return;
        const tools = metadata.agenthubTools.filter((tool: { name?: string }) => tool.name !== name);
        if (tools.length === metadata.agenthubTools.length) return;
        metadata.agenthubTools = tools;
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }
}
