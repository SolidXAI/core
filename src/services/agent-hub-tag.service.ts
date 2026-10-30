import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { AgentRegistry } from '../entities/agent-registry.entity';
import { AgentHubTag } from '../entities/agent-hub-tag.entity';
import { AgentSkillRegistry } from '../entities/agent-skill-registry.entity';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { AgentHubTagRepository } from '../repository/agent-hub-tag.repository';
import { ModuleMetadataHelperService } from '../helpers/module-metadata-helper.service';
import { updateModuleMetadataJson } from '../subscribers/agenthub-metadata-sync.util';
import { CRUDService } from './crud.service';

@Injectable()
export class AgentHubTagService extends CRUDService<AgentHubTag> {
    private readonly logger = new Logger(AgentHubTagService.name);

    constructor(
        @InjectEntityManager('default')
        readonly entityManager: EntityManager,
        readonly repo: AgentHubTagRepository,
        readonly moduleRef: ModuleRef,
    ) {
        super(entityManager, repo, 'agentHubTag', 'agent-hub', moduleRef);
    }

    override async update(
        id: number,
        updateDto: any,
        files: Express.Multer.File[] = [],
        isPartialUpdate = false,
        solidRequestContext: any = {},
        isUpdate = false,
    ): Promise<AgentHubTag> {
        const before = await this.repo.findOne({
            where: { id },
            relations: { agents: true, skills: true, tools: true },
        });

        const savedTag = await super.update(id, updateDto, files, isPartialUpdate, solidRequestContext, isUpdate);
        const after = await this.repo.findOne({
            where: { id },
            relations: { agents: true, skills: true, tools: true },
        });

        if (!after) return savedTag;

        await Promise.all([
            this.syncLinkedTags(AgentRegistry, 'agenthubAgents', this.getIds(before?.agents, after.agents)),
            this.syncLinkedTags(AgentSkillRegistry, 'agenthubSkills', this.getIds(before?.skills, after.skills)),
            this.syncLinkedTags(AgentToolRegistry, 'agenthubTools', this.getIds(before?.tools, after.tools)),
        ]);

        return savedTag;
    }

    private getIds(before: Array<{ id: number }> = [], after: Array<{ id: number }> = []): number[] {
        return [...new Set([...before, ...after].map(({ id }) => id))];
    }

    private async syncLinkedTags(
        entity: typeof AgentRegistry | typeof AgentSkillRegistry | typeof AgentToolRegistry,
        metadataKey: 'agenthubAgents' | 'agenthubSkills' | 'agenthubTools',
        ids: number[],
    ): Promise<void> {
        if (!ids.length) return;

        const entities = await this.entityManager.getRepository(entity).find({
            where: { id: In(ids) },
            relations: { module: true, tags: true },
        });
        const helper = this.moduleRef.get(ModuleMetadataHelperService, { strict: false });
        const byModule = new Map<string, typeof entities>();
        for (const linkedEntity of entities) {
            const moduleName = linkedEntity.module?.name;
            if (!moduleName) continue;
            const records = byModule.get(moduleName) ?? [];
            records.push(linkedEntity);
            byModule.set(moduleName, records);
        }

        await Promise.all([...byModule].map(([moduleName, records]) =>
            updateModuleMetadataJson(moduleName, helper, this.logger, (metadata) => {
                if (!Array.isArray(metadata[metadataKey])) return false;
                let changed = false;
                for (const linkedEntity of records) {
                    const entry = metadata[metadataKey].find((item: { name?: string }) => item.name === linkedEntity.name);
                    if (!entry) continue;
                    const tags = (linkedEntity.tags ?? []).map((tag: AgentHubTag) => tag.name);
                    if (JSON.stringify(entry.tags ?? []) === JSON.stringify(tags)) continue;
                    entry.tags = tags;
                    changed = true;
                }
                return changed;
            }),
        ));
    }
}
