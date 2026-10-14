import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { AgentSkill } from 'src/entities/agent-skill.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentSkillSubscriber implements EntitySubscriberInterface<AgentSkill> {
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
        await this.sync(event);
    }

    async afterUpdate(event: UpdateEvent<AgentSkill>): Promise<void> {
        await this.sync(event);
    }

    async afterRemove(event: RemoveEvent<AgentSkill>): Promise<void> {
        await this.sync(event);
    }

    private async sync(event: InsertEvent<AgentSkill> | UpdateEvent<AgentSkill> | RemoveEvent<AgentSkill>): Promise<void> {
        const entity = event.entity as AgentSkill | undefined;
        const databaseEntity = 'databaseEntity' in event ? event.databaseEntity as AgentSkill | undefined : undefined;
        let agentId = entity?.agentRegistry?.id ?? entity?.agentRegistryId
            ?? databaseEntity?.agentRegistry?.id ?? databaseEntity?.agentRegistryId;
        if (!agentId && entity?.id) {
            const link = await event.manager.getRepository(AgentSkill).findOne({
                where: { id: entity.id },
                relations: { agentRegistry: true },
            });
            agentId = link?.agentRegistry?.id;
        }
        if (agentId) await this.agentRegistrySubscriber.syncAgentSkills(agentId, event.manager);
    }
}
