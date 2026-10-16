import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { AgentTool } from 'src/entities/agent-tool.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentToolSubscriber implements EntitySubscriberInterface<AgentTool> {
    private readonly removedAgentIds = new Map<number, number>();

    constructor(
        @InjectDataSource() dataSource: DataSource,
        private readonly agentRegistrySubscriber: AgentRegistrySubscriber,
    ) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentTool;
    }

    async afterInsert(event: InsertEvent<AgentTool>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentTools(event);
    }

    async afterUpdate(event: UpdateEvent<AgentTool>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentTools(event);
    }

    async beforeRemove(event: RemoveEvent<AgentTool>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberAgentId(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentTool>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberAgentId(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<AgentTool>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentToolsAfterRemoval(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentTool>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentToolsAfterRemoval(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    private async writeAgentTools(event: InsertEvent<AgentTool> | UpdateEvent<AgentTool>): Promise<void> {
        const entity = event.entity as AgentTool | undefined;
        let agentId = entity?.agentRegistry?.id ?? entity?.agentRegistryId;
        if (!agentId && entity?.id) {
            const link = await event.manager.getRepository(AgentTool).findOne({
                where: { id: entity.id },
                relations: { agentRegistry: true },
            });
            agentId = link?.agentRegistry?.id;
        }
        if (agentId) await this.agentRegistrySubscriber.writeAgentToolsToMetadata(agentId, event.manager);
    }

    private async rememberAgentId(manager: EntityManager, linkId?: number): Promise<void> {
        if (!linkId) return;
        const link = await manager.getRepository(AgentTool).findOne({
            where: { id: linkId },
            relations: { agentRegistry: true },
            withDeleted: true,
        });
        if (link?.agentRegistry?.id) this.removedAgentIds.set(linkId, link.agentRegistry.id);
    }

    private async writeAgentToolsAfterRemoval(linkId: number | undefined, manager: EntityManager): Promise<void> {
        if (!linkId) return;
        const agentId = this.removedAgentIds.get(linkId);
        this.removedAgentIds.delete(linkId);
        if (agentId) await this.agentRegistrySubscriber.writeAgentToolsToMetadata(agentId, manager);
    }
}
