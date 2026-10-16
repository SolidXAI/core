import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { AgentSkill } from 'src/entities/agent-skill.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentSkillSubscriber implements EntitySubscriberInterface<AgentSkill> {
    private readonly removedAgentIds = new Map<number, number>();

    constructor(
        @InjectDataSource() dataSource: DataSource,
        private readonly agentRegistrySubscriber: AgentRegistrySubscriber,
    ) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentSkill;
    }

    async afterInsert(event: InsertEvent<AgentSkill>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentSkills(event);
    }

    async afterUpdate(event: UpdateEvent<AgentSkill>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentSkills(event);
    }

    async beforeRemove(event: RemoveEvent<AgentSkill>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberAgentId(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentSkill>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberAgentId(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<AgentSkill>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentSkillsAfterRemoval(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentSkill>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentSkillsAfterRemoval(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    private async writeAgentSkills(event: InsertEvent<AgentSkill> | UpdateEvent<AgentSkill>): Promise<void> {
        const entity = event.entity as AgentSkill | undefined;
        let agentId = entity?.agentRegistry?.id ?? entity?.agentRegistryId;
        if (!agentId && entity?.id) {
            const link = await event.manager.getRepository(AgentSkill).findOne({
                where: { id: entity.id },
                relations: { agentRegistry: true },
            });
            agentId = link?.agentRegistry?.id;
        }
        if (agentId) await this.agentRegistrySubscriber.writeAgentSkillsToMetadata(agentId, event.manager);
    }

    private async rememberAgentId(manager: EntityManager, linkId?: number): Promise<void> {
        if (!linkId) return;
        const link = await manager.getRepository(AgentSkill).findOne({
            where: { id: linkId },
            relations: { agentRegistry: true },
            withDeleted: true,
        });
        if (link?.agentRegistry?.id) this.removedAgentIds.set(linkId, link.agentRegistry.id);
    }

    private async writeAgentSkillsAfterRemoval(linkId: number | undefined, manager: EntityManager): Promise<void> {
        if (!linkId) return;
        const agentId = this.removedAgentIds.get(linkId);
        this.removedAgentIds.delete(linkId);
        if (agentId) await this.agentRegistrySubscriber.writeAgentSkillsToMetadata(agentId, manager);
    }
}
