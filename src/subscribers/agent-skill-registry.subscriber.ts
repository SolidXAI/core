import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { AgentSkillRegistry } from 'src/entities/agent-skill-registry.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { updateModuleMetadataJson } from './agenthub-metadata-sync.util';

@Injectable()
export class AgentSkillRegistrySubscriber implements EntitySubscriberInterface<AgentSkillRegistry> {
    private readonly logger = new Logger(AgentSkillRegistrySubscriber.name);

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return AgentSkillRegistry;
    }

    async afterInsert(event: InsertEvent<AgentSkillRegistry>): Promise<void> {
        await this.syncMetadata(event);
    }

    async afterUpdate(event: UpdateEvent<AgentSkillRegistry>): Promise<void> {
        await this.syncMetadata(event);
    }

    private async syncMetadata(event: InsertEvent<AgentSkillRegistry> | UpdateEvent<AgentSkillRegistry>): Promise<void> {
        if (!event.entity?.id) return;
        const skill = await event.manager.getRepository(AgentSkillRegistry).findOne({
            where: { id: event.entity.id },
            relations: { module: true, tags: true },
        });
        if (!skill) throw new Error(`Agent skill registry record not found for id ${event.entity.id}`);
        const moduleName = skill.module?.name;
        if (!moduleName) throw new Error(`Module not found for skill ${skill.name}`);
        if (moduleName === SOLID_CORE_MODULE_NAME) return;

        await updateModuleMetadataJson(moduleName, this.moduleMetadataHelperService, this.logger, (metadata) => {
            const skills = metadata.agenthubSkills ?? [];
            const index = skills.findIndex((item: { name: string }) => item.name === skill.name);
            const entry = {
                name: skill.name,
                type: skill.type,
                iconName: skill.iconName,
                description: skill.description,
                body: skill.body,
                tags: skill.tags.map((tag) => tag.name).sort(),
                moduleUserKey: moduleName,
            };
            if (index === -1) skills.push(entry);
            else skills[index] = entry;
            metadata.agenthubSkills = skills;
            return true;
        });
    }
}
