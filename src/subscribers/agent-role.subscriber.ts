import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { AgentRole } from 'src/entities/agent-role.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentRoleSubscriber implements EntitySubscriberInterface<AgentRole> {
    constructor(@InjectDataSource() dataSource: DataSource, private readonly agentRegistrySubscriber: AgentRegistrySubscriber) {
        dataSource.subscribers.push(this);
    }

    listenTo() { return AgentRole; }

    async afterInsert(event: InsertEvent<AgentRole>) { await this.sync(event); }

    async afterUpdate(event: UpdateEvent<AgentRole>) { await this.sync(event); }

    private async sync(event: InsertEvent<AgentRole> | UpdateEvent<AgentRole>) {
        const entity = event.entity as AgentRole | undefined;
        let agentId = entity?.agentRegistry?.id;
        if (!agentId && entity?.id) {
            const link = await event.manager.getRepository(AgentRole).findOne({
                where: { id: entity.id },
                relations: { agentRegistry: true },
            });
            agentId = link?.agentRegistry?.id;
        }
        if (agentId) await this.agentRegistrySubscriber.syncAgentRoles(agentId, event.manager);
    }
}
