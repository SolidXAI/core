import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { AgentTool } from 'src/entities/agent-tool.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentToolSubscriber implements EntitySubscriberInterface<AgentTool> {
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
        await this.sync(event);
    }

    async afterUpdate(event: UpdateEvent<AgentTool>): Promise<void> {
        await this.sync(event);
    }

    async afterRemove(event: RemoveEvent<AgentTool>): Promise<void> {
        await this.sync(event);
    }

    private async sync(event: InsertEvent<AgentTool> | UpdateEvent<AgentTool> | RemoveEvent<AgentTool>): Promise<void> {
        const entity = event.entity as AgentTool | undefined;
        const databaseEntity = 'databaseEntity' in event ? event.databaseEntity as AgentTool | undefined : undefined;
        let agentId = entity?.agentRegistry?.id ?? entity?.agentRegistryId
            ?? databaseEntity?.agentRegistry?.id ?? databaseEntity?.agentRegistryId;
        if (!agentId && entity?.id) {
            const link = await event.manager.getRepository(AgentTool).findOne({
                where: { id: entity.id },
                relations: { agentRegistry: true },
            });
            agentId = link?.agentRegistry?.id;
        }
        if (agentId) await this.agentRegistrySubscriber.syncAgentTools(agentId, event.manager);
    }
}
