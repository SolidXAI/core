import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { Secret } from 'src/entities/secret.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { updateModuleMetadataJson } from './agenthub-metadata-sync.util';

@Injectable()
export class SecretSubscriber implements EntitySubscriberInterface<Secret> {
    private readonly logger = new Logger(SecretSubscriber.name);
    private readonly previousSecrets = new Map<number, { key: string; moduleName?: string }>();

    constructor(@InjectDataSource() dataSource: DataSource, private readonly helper: ModuleMetadataHelperService) {
        dataSource.subscribers.push(this);
    }

    listenTo() { return Secret; }
    async afterInsert(event: InsertEvent<Secret>) { await this.sync(event); }
    async beforeUpdate(event: UpdateEvent<Secret>) {
        const id = event.entity?.id ?? event.databaseEntity?.id;
        if (!id) return;
        const secret = await event.manager.getRepository(Secret).findOne({ where: { id }, relations: { module: true } });
        if (secret) this.previousSecrets.set(id, { key: secret.key, moduleName: secret.module?.name });
    }
    async afterUpdate(event: UpdateEvent<Secret>) {
        await this.sync(event);
        const id = event.entity?.id;
        const previous = id ? this.previousSecrets.get(id) : undefined;
        if (id) this.previousSecrets.delete(id);
        if (!previous || !id) return;
        const current = await event.manager.getRepository(Secret).findOne({ where: { id }, relations: { module: true } });
        if (current && previous.key === current.key && previous.moduleName === current.module?.name) return;
        await updateModuleMetadataJson(previous.moduleName, this.helper, this.logger, (metadata) => {
            if (!Array.isArray(metadata.secrets)) return false;
            const entries = metadata.secrets.filter((item: { key?: string }) => item.key !== previous.key);
            if (entries.length === metadata.secrets.length) return false;
            metadata.secrets = entries;
            return true;
        });
    }

    private async sync(event: InsertEvent<Secret> | UpdateEvent<Secret>) {
        const id = event.entity?.id;
        if (!id) return;
        const secret = await event.manager.getRepository(Secret).findOne({ where: { id }, relations: { module: true } });
        if (!secret) return;
        await updateModuleMetadataJson(secret.module?.name, this.helper, this.logger, (metadata) => {
            if (!Array.isArray(metadata.secrets)) metadata.secrets = [];
            const values = {
                key: secret.key, displayName: secret.displayName, description: secret.description,
                redact: secret.redact, valueType: secret.valueType, status: secret.status,
                lastRotatedAt: secret.lastRotatedAt, lastAccessedAt: secret.lastAccessedAt,
                moduleUserKey: secret.module?.name,
            };
            const index = metadata.secrets.findIndex((item: { key?: string }) => item.key === secret.key);
            if (index < 0) metadata.secrets.push(values);
            else {
                delete metadata.secrets[index].value;
                metadata.secrets[index] = { ...metadata.secrets[index], ...values };
            }
            return true;
        });
    }
}
