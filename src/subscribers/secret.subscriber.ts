import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { Secret } from 'src/entities/secret.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { AgentSecret } from 'src/entities/agent-secret.entity';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';

@Injectable()
export class SecretSubscriber implements EntitySubscriberInterface<Secret> {
    private readonly logger = new Logger(SecretSubscriber.name);
    private readonly previousSecrets = new Map<number, { key: string; moduleName?: string }>();
    private readonly deletedSecrets = new Map<number, { key: string; moduleName?: string; agentIds: number[] }>();

    constructor(
        @InjectDataSource() dataSource: DataSource,
        private readonly helper: ModuleMetadataHelperService,
        private readonly agentRegistrySubscriber: AgentRegistrySubscriber,
    ) {
        dataSource.subscribers.push(this);
    }

    listenTo() { return Secret; }
    async afterInsert(event: InsertEvent<Secret>) {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const secret = await this.getSecret(event.manager, event.entity?.id);
        if (secret) await this.writeSecret(secret);
    }

    async beforeUpdate(event: UpdateEvent<Secret>) {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const secret = await event.manager.getRepository(Secret).findOne({ where: { id }, relations: { module: true } });
        if (secret) this.previousSecrets.set(id, { key: secret.key, moduleName: secret.module?.name });
    }

    async beforeRemove(event: RemoveEvent<Secret>) {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedSecret(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async beforeSoftRemove(event: SoftRemoveEvent<Secret>) {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.rememberDeletedSecret(event.manager, event.entity?.id ?? event.databaseEntity?.id ?? event.entityId);
    }

    async afterRemove(event: RemoveEvent<Secret>) {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedSecret(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    async afterSoftRemove(event: SoftRemoveEvent<Secret>) {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        await this.removeDeletedSecret(event.entity?.id ?? event.databaseEntity?.id ?? event.entityId, event.manager);
    }

    async afterUpdate(event: UpdateEvent<Secret>) {
        const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
        if (solidCliRunning === "true") {
            return;
        }

        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const previous = this.previousSecrets.get(id);
        this.previousSecrets.delete(id);

        const current = await this.getSecret(event.manager, id);
        if (!current) return;
        await this.writeSecret(current);

        if (!previous || (previous.key === current.key && previous.moduleName === current.module?.name)) return;
        await this.removeSecret(previous.moduleName, previous.key);
    }

    private async getSecret(manager: EntityManager, id?: number): Promise<Secret | null> {
        if (!id) return null;
        const secret = await manager.getRepository(Secret).findOne({ where: { id }, relations: { module: true } });
        return secret;
    }

    private async rememberDeletedSecret(manager: EntityManager, id?: number): Promise<void> {
        if (!id) return;
        const secret = await manager.getRepository(Secret).findOne({ where: { id }, relations: { module: true } });
        if (!secret) return;

        // --- Agent links: capture linked agents now; the DB cascade removes these links on delete ---
        const links = await manager.getRepository(AgentSecret).find({
            where: { secret: { id } },
            relations: { agentRegistry: true },
        });
        this.deletedSecrets.set(id, {
            key: secret.key,
            moduleName: secret.module?.name,
            agentIds: links.map((link) => link.agentRegistry.id),
        });
    }

    private async removeDeletedSecret(id: number | undefined, manager: EntityManager): Promise<void> {
        if (!id) return;
        const secret = this.deletedSecrets.get(id);
        this.deletedSecrets.delete(id);
        if (!secret) return;

        // --- Secret update: remove the secret entry ---
        await this.removeSecret(secret.moduleName, secret.key);

        // --- Agent update: rewrite the secret list of every agent that used it (one at a time) ---
        for (const agentId of secret.agentIds) {
            await this.agentRegistrySubscriber.writeAgentSecretsToMetadata(agentId, manager);
        }
    }

    private async writeSecret(secret: Secret): Promise<void> {
        const moduleName = secret.module?.name;
        if (!moduleName || moduleName === SOLID_CORE_MODULE_NAME) return;
        const filePath = await this.helper.getModuleMetadataFilePath(moduleName);
        let metadata: any;
        try {
            this.logger.warn(`METADATA READ START pid=${process.pid} at=${Date.now()} path=${filePath}`);
            metadata = JSON.parse(await fs.readFile(filePath, 'utf8'));
            this.logger.warn(`METADATA READ END pid=${process.pid} at=${Date.now()} path=${filePath}`);
        } catch (error: any) {
            this.logger.error(`Failed to read module metadata at ${filePath}: ${error?.message ?? error}`);
            return;
        }
        if (!Array.isArray(metadata.secrets)) metadata.secrets = [];
        const values = {
            key: secret.key, displayName: secret.displayName, description: secret.description,
            redact: secret.redact, valueType: secret.valueType, status: secret.status,
            // lastRotatedAt: secret.lastRotatedAt, lastAccessedAt: secret.lastAccessedAt,
            moduleUserKey: moduleName,
        };
        const index = metadata.secrets.findIndex((item: { key?: string }) => item.key === secret.key);
        if (index < 0) metadata.secrets.push(values);
        else {
            delete metadata.secrets[index].value;
            metadata.secrets[index] = { ...metadata.secrets[index], ...values };
        }
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }

    private async removeSecret(moduleName: string | undefined, key: string): Promise<void> {
        if (!moduleName || moduleName === SOLID_CORE_MODULE_NAME) return;
        const filePath = await this.helper.getModuleMetadataFilePath(moduleName);
        let metadata: any;
        try {
            this.logger.warn(`METADATA READ START pid=${process.pid} at=${Date.now()} path=${filePath}`);
            metadata = JSON.parse(await fs.readFile(filePath, 'utf8'));
            this.logger.warn(`METADATA READ END pid=${process.pid} at=${Date.now()} path=${filePath}`);
        } catch (error: any) {
            this.logger.error(`Failed to read module metadata at ${filePath}: ${error?.message ?? error}`);
            return;
        }
        if (!Array.isArray(metadata.secrets)) return;
        const entries = metadata.secrets.filter((item: { key?: string }) => item.key !== key);
        if (entries.length === metadata.secrets.length) return;
        metadata.secrets = entries;
        this.logger.warn(`METADATA WRITE START pid=${process.pid} at=${Date.now()} path=${filePath}`);
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
        this.logger.warn(`METADATA WRITE END pid=${process.pid} at=${Date.now()} path=${filePath}`);
    }
}
