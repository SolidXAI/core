import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { AgentSecret } from 'src/entities/agent-secret.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentSecretSubscriber implements EntitySubscriberInterface<AgentSecret> {
    constructor(@InjectDataSource() dataSource: DataSource, private readonly agentRegistrySubscriber: AgentRegistrySubscriber) {
        dataSource.subscribers.push(this);
    }
    listenTo() { return AgentSecret; }
    async afterInsert(event: InsertEvent<AgentSecret>) { await this.sync(event); }
    async afterUpdate(event: UpdateEvent<AgentSecret>) { await this.sync(event); }
    private async sync(event: InsertEvent<AgentSecret> | UpdateEvent<AgentSecret>) {
        const entity = event.entity as AgentSecret | undefined;
        let agentId = entity?.agentRegistry?.id;
        if (!agentId && entity?.id) {
            const link = await event.manager.getRepository(AgentSecret).findOne({ where: { id: entity.id }, relations: { agentRegistry: true } });
            agentId = link?.agentRegistry?.id;
        }
        if (agentId) await this.agentRegistrySubscriber.syncAgentSecrets(agentId, event.manager);
    }
}
