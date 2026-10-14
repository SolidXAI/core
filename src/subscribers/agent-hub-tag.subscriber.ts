import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentHubTag } from 'src/entities/agent-hub-tag.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { getRemoveEntityId, updateModuleMetadataJson } from './agenthub-metadata-sync.util';

type TagReference = { name: string; moduleName?: string };
type TagDeletion = {
    name: string;
    moduleName?: string;
    agents: TagReference[];
    skills: TagReference[];
    tools: TagReference[];
};

@Injectable()
export class AgentHubTagSubscriber implements EntitySubscriberInterface<AgentHubTag> {
    private readonly logger = new Logger(AgentHubTagSubscriber.name);
    private readonly removals = new Map<number, TagDeletion>();

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentHubTag;
    }

    async afterInsert(event: InsertEvent<AgentHubTag>): Promise<void> {
        await this.syncMetadata(event);
    }

    async afterUpdate(event: UpdateEvent<AgentHubTag>): Promise<void> {
        await this.syncMetadata(event);
    }

    async beforeRemove(event: RemoveEvent<AgentHubTag>): Promise<void> {
        const id = getRemoveEntityId(event);
        if (!id) return;
        const tag = await event.manager.getRepository(AgentHubTag).findOne({
            where: { id },
            relations: {
                module: true,
                agents: { module: true },
                skills: { module: true },
                tools: { module: true },
            },
        });
        if (!tag) return;
        this.removals.set(id, {
            name: tag.name,
            moduleName: tag.module?.name,
            agents: (tag.agents ?? []).map(({ name, module }) => ({ name, moduleName: module?.name })),
            skills: (tag.skills ?? []).map(({ name, module }) => ({ name, moduleName: module?.name })),
            tools: (tag.tools ?? []).map(({ name, module }) => ({ name, moduleName: module?.name })),
        });
    }

    async afterRemove(event: RemoveEvent<AgentHubTag>): Promise<void> {
        const id = getRemoveEntityId(event);
        const deletion = id ? this.removals.get(id) : undefined;
        if (id) this.removals.delete(id);
        if (!deletion) return;

        const modules = new Map<string, TagDeletion>();
        const addToModule = (moduleName: string | undefined, key: 'agents' | 'skills' | 'tools', reference?: TagReference) => {
            if (!moduleName) return;
            const current = modules.get(moduleName) ?? { name: deletion.name, agents: [], skills: [], tools: [] };
            if (reference) current[key].push(reference);
            modules.set(moduleName, current);
        };
        addToModule(deletion.moduleName, 'agents');
        deletion.agents.forEach((reference) => addToModule(reference.moduleName, 'agents', reference));
        deletion.skills.forEach((reference) => addToModule(reference.moduleName, 'skills', reference));
        deletion.tools.forEach((reference) => addToModule(reference.moduleName, 'tools', reference));

        for (const [moduleName, references] of modules) {
            await updateModuleMetadataJson(moduleName, this.moduleMetadataHelperService, this.logger, (metadata) => {
                let changed = false;
                if (moduleName === deletion.moduleName && Array.isArray(metadata.agenthubTags)) {
                    const tags = metadata.agenthubTags.filter((tag: { name?: string }) => tag.name !== deletion.name);
                    changed ||= tags.length !== metadata.agenthubTags.length;
                    metadata.agenthubTags = tags;
                }
                for (const [key, affected] of [
                    ['agenthubAgents', references.agents],
                    ['agenthubSkills', references.skills],
                    ['agenthubTools', references.tools],
                ] as const) {
                    if (!Array.isArray(metadata[key])) continue;
                    for (const entry of metadata[key]) {
                        if (!affected.some((reference) => reference.name === entry.name)) continue;
                        const tags = Array.isArray(entry.tags) ? entry.tags : [];
                        const nextTags = tags.filter((name: string) => name !== deletion.name);
                        if (nextTags.length !== tags.length) {
                            entry.tags = nextTags;
                            changed = true;
                        }
                    }
                }
                return changed;
            });
        }
    }

    async beforeSoftRemove(event: SoftRemoveEvent<AgentHubTag>): Promise<void> {
        await this.beforeRemove(event as RemoveEvent<AgentHubTag>);
    }

    async afterSoftRemove(event: SoftRemoveEvent<AgentHubTag>): Promise<void> {
        await this.afterRemove(event as RemoveEvent<AgentHubTag>);
    }

    private async syncMetadata(event: InsertEvent<AgentHubTag> | UpdateEvent<AgentHubTag>): Promise<void> {
        if (!event.entity?.id) return;
        const tag = await event.manager.getRepository(AgentHubTag).findOne({
            where: { id: event.entity.id },
            relations: { module: true },
        });
        if (!tag) throw new Error(`AgentHub tag not found for id ${event.entity.id}`);
        const moduleName = tag.module?.name;
        if (!moduleName) throw new Error(`Module not found for tag ${tag.name}`);
        if (moduleName === SOLID_CORE_MODULE_NAME) return;

        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        try {
            await fs.access(filePath);
        } catch {
            this.logger.error(`Module metadata file not found: ${filePath}`);
            return;
        }
        const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
        if (!metadata) throw new Error(`Module metadata could not be read: ${filePath}`);

        const tags = metadata.agenthubTags ?? [];
        const index = tags.findIndex((item: { name: string }) => item.name === tag.name);
        const entry = { name: tag.name, moduleUserKey: moduleName };
        if (index === -1) tags.push(entry);
        else tags[index] = entry;
        metadata.agenthubTags = tags;
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
}
