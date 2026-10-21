import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { AgentRole } from 'src/entities/agent-role.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentRoleSubscriber implements EntitySubscriberInterface<AgentRole> {
    private readonly removedAgentIds = new Map<number, number>();

    constructor(
        @InjectDataSource() dataSource: DataSource,
        private readonly agentRegistrySubscriber: AgentRegistrySubscriber,
    ) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentRole;
    }

    async afterInsert(event: InsertEvent<AgentRole>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentRoles(event);
    }

    async afterUpdate(event: UpdateEvent<AgentRole>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentRoles(event);
    }

    async beforeRemove(event: RemoveEvent<AgentRole>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberAgentId(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentRole>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberAgentId(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<AgentRole>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentRolesAfterRemoval(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentRole>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentRolesAfterRemoval(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    private async writeAgentRoles(event: InsertEvent<AgentRole> | UpdateEvent<AgentRole>): Promise<void> {
        const entity = event.entity as AgentRole | undefined;
        let agentId = entity?.agentRegistry?.id;
        if (!agentId && entity?.id) {
            const link = await event.manager.getRepository(AgentRole).findOne({
                where: { id: entity.id },
                relations: { agentRegistry: true },
            });
            agentId = link?.agentRegistry?.id;
        }
        if (agentId) await this.agentRegistrySubscriber.writeAgentRolesToMetadata(agentId, event.manager);
    }

    private async rememberAgentId(manager: EntityManager, linkId?: number): Promise<void> {
        if (!linkId) return;
        const link = await manager.getRepository(AgentRole).findOne({
            where: { id: linkId },
            relations: { agentRegistry: true },
            withDeleted: true,
        });
        if (link?.agentRegistry?.id) this.removedAgentIds.set(linkId, link.agentRegistry.id);
    }

    private async writeAgentRolesAfterRemoval(linkId: number | undefined, manager: EntityManager): Promise<void> {
        if (!linkId) return;
        const agentId = this.removedAgentIds.get(linkId);
        this.removedAgentIds.delete(linkId);
        if (agentId) await this.agentRegistrySubscriber.writeAgentRolesToMetadata(agentId, manager);
    }
}
