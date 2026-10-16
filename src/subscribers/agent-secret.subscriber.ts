import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { AgentSecret } from 'src/entities/agent-secret.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class AgentSecretSubscriber implements EntitySubscriberInterface<AgentSecret> {
    private readonly removedAgentIds = new Map<number, number>();

    constructor(
        @InjectDataSource() dataSource: DataSource,
        private readonly agentRegistrySubscriber: AgentRegistrySubscriber,
    ) {
        dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentSecret;
    }

    async afterInsert(event: InsertEvent<AgentSecret>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentSecrets(event);
    }

    async afterUpdate(event: UpdateEvent<AgentSecret>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentSecrets(event);
    }

    async beforeRemove(event: RemoveEvent<AgentSecret>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberAgentId(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentSecret>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberAgentId(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<AgentSecret>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentSecretsAfterRemoval(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentSecret>): Promise<void> {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.writeAgentSecretsAfterRemoval(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    private async writeAgentSecrets(event: InsertEvent<AgentSecret> | UpdateEvent<AgentSecret>): Promise<void> {
        const entity = event.entity as AgentSecret | undefined;
        let agentId = entity?.agentRegistry?.id;
        if (!agentId && entity?.id) {
            const link = await event.manager.getRepository(AgentSecret).findOne({
                where: { id: entity.id },
                relations: { agentRegistry: true },
            });
            agentId = link?.agentRegistry?.id;
        }
        if (agentId) await this.agentRegistrySubscriber.writeAgentSecretsToMetadata(agentId, event.manager);
    }

    private async rememberAgentId(manager: EntityManager, linkId?: number): Promise<void> {
        if (!linkId) return;
        const link = await manager.getRepository(AgentSecret).findOne({
            where: { id: linkId },
            relations: { agentRegistry: true },
            withDeleted: true,
        });
        if (link?.agentRegistry?.id) this.removedAgentIds.set(linkId, link.agentRegistry.id);
    }

    private async writeAgentSecretsAfterRemoval(linkId: number | undefined, manager: EntityManager): Promise<void> {
        if (!linkId) return;
        const agentId = this.removedAgentIds.get(linkId);
        this.removedAgentIds.delete(linkId);
        if (agentId) await this.agentRegistrySubscriber.writeAgentSecretsToMetadata(agentId, manager);
    }
}
