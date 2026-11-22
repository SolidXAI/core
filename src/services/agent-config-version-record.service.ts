import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { Brackets, EntityManager, In } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentConfigVersion } from '../entities/agent-config-version.entity';
import { AgentConfigVersionRepository } from '../repository/agent-config-version.repository';
import { AgentRegistryRepository } from '../repository/agent-registry.repository';
import { AgentToolRepository } from '../repository/agent-tool.repository';
import { AgentToolRegistryRepository } from '../repository/agent-tool-registry.repository';
import { toolLinksAt, toolFieldAt, TOOL_COMPARISON_FIELDS, ToolLinkAudit } from '../helpers/agent-tool-comparison';
import { AGENT_GENERAL_CONFIG_FIELDS, compareAgentGeneralConfig } from '../helpers/agent-general-config-comparison';
import { AgentSkillRepository } from '../repository/agent-skill.repository';
import { AgentSkillRegistryRepository } from '../repository/agent-skill-registry.repository';
import { ChatterMessageRepository } from '../repository/chatter-message.repository';
import { RequestContextService } from './request-context.service';
import { LocalDateTimeTransformer } from '../transformers/typeorm/local-date-time-transformer';
@Injectable()
export class AgentConfigVersionRecordService extends CRUDService<AgentConfigVersion> {
    constructor(
        @InjectEntityManager('default')
        readonly entityManager: EntityManager,
        readonly repo: AgentConfigVersionRepository,
        readonly moduleRef: ModuleRef,
    ) {
        super(entityManager, repo, 'agentConfigVersion', 'agent-hub', moduleRef);
    }

    async getComparison(agentId: number, leftVersionId: number, rightVersionId: number) {
        // 1. Validate the request and read permissions.
        if (![agentId, leftVersionId, rightVersionId].every((id) => Number.isSafeInteger(id) && id > 0) || leftVersionId === rightVersionId) {
            throw new BadRequestException('Provide a positive agent ID and two different config-version IDs.');
        }
        const activeUser = this.moduleRef.get(RequestContextService, { strict: false }).getActiveUser();
        const models = ['agentRegistry', 'agentConfigVersion', 'agentSkill', 'agentSkillRegistry', 'agentTool', 'agentToolRegistry', 'chatterMessage', 'chatterMessageDetails'];
        if (!activeUser || models.some((model) => !this.crudHelperService.hasReadPermissionOnModel(activeUser, model))) {
            throw new ForbiddenException('You do not have permission to compare these configurations.');
        }

        // 2. Fetch both versions for this agent and establish the date range.
        const [versions, agent] = await Promise.all([
            this.repo.find({
                where: { id: In([leftVersionId, rightVersionId]), agentRegistry: { id: agentId } },
                select: { id: true, versionNumber: true, name: true, description: true, createdAt: true },
                order: { createdAt: 'ASC', id: 'ASC' },
            }),
            this.moduleRef.get(AgentRegistryRepository, { strict: false }).findOne({
                where: { id: agentId }, select: { id: true, reasoningModelKey: true, fastModelKey: true,
                    ...Object.fromEntries(Object.keys(AGENT_GENERAL_CONFIG_FIELDS).map((field) => [field, true])) },
            }),
        ]);
        if (!agent || versions.length !== 2) {
            throw new NotFoundException('Both config versions must belong to the specified agent and be accessible.');
        }
        const [older, newer] = versions;

        // 3. Fetch prompt changes in the range and configuration history, oldest first.
        // History outside the range resolves values for historical versions.
        // Prompt values are reserved for the actual-diff endpoint.
        const chatter = this.moduleRef.get(ChatterMessageRepository, { strict: false });
        const query = await chatter.createSecurityRuleAwareQueryBuilder('entity');
        const historicalFields = ['reasoningModelKey', 'fastModelKey', ...Object.keys(AGENT_GENERAL_CONFIG_FIELDS)];
        const fields = ['systemPrompt', ...historicalFields];
        const agentRegistryEntries = await query.innerJoin('entity.chatterMessageDetails', 'detail')
            .andWhere('entity.messageType = :messageType', { messageType: 'audit' })
            .andWhere('entity.coModelName = :modelName', { modelName: 'agentRegistry' })
            .andWhere('entity.coModelEntityId = :agentId', { agentId })
            .andWhere('detail.fieldName IN (:...fields)', { fields })
            .andWhere(new Brackets((where) => {
                where.where('detail.fieldName IN (:...historicalFields)', { historicalFields })
                    .orWhere("detail.fieldName = 'systemPrompt' AND entity.createdAt > :start AND entity.createdAt <= :end");
            }))
            .setParameters({ start: LocalDateTimeTransformer.to(older.createdAt), end: LocalDateTimeTransformer.to(newer.createdAt) })
            .select('entity.id', 'messageId')
            .addSelect('entity.createdAt', 'createdAt')
            .addSelect('detail.fieldName', 'fieldName')
            .addSelect("CASE WHEN detail.fieldName <> 'systemPrompt' THEN detail.oldValue ELSE NULL END", 'oldValue')
            .addSelect("CASE WHEN detail.fieldName <> 'systemPrompt' THEN detail.newValue ELSE NULL END", 'newValue')
            .orderBy('entity.createdAt', 'ASC')
            .addOrderBy('entity.id', 'ASC')
            .addOrderBy('detail.id', 'ASC')
            .getRawMany();

        // 4. Group entries and identify whether the persona changed in the window.
        const agentRegistryChanges: Record<string, any[]> = Object.fromEntries(fields.map((field) => [field, []]));
        for (const entry of agentRegistryEntries) {
            agentRegistryChanges[entry.fieldName].push({
                ...entry,
                messageId: Number(entry.messageId),
                createdAt: LocalDateTimeTransformer.from(entry.createdAt),
            });
        }
        const promptChanged = agentRegistryChanges.systemPrompt.length > 0;

        // 5. Fetch association history, including removed links, and group changes by catalog skill ID.
        const currentAgentSkills = await this.moduleRef.get(AgentSkillRepository, { strict: false }).find({
            where: { agentRegistry: { id: agentId } }, withDeleted: true,
            relations: { agentSkillRegistry: true },
            select: { id: true, createdAt: true, deletedAt: true, alwaysInclude: true, agentSkillRegistry: { id: true } },
        });
        const currentLinkIds = currentAgentSkills.map((link) => link.id);
        const agentSkillQuery = await chatter.createSecurityRuleAwareQueryBuilder('entity');
        agentSkillQuery.andWhere('entity.messageType = :messageType', { messageType: 'audit' })
            .andWhere('entity.coModelName = :modelName', { modelName: 'agentSkill' });
        // Discover link IDs once in a subquery so keyless update entries are included too.
        const linkIdsQuery = agentSkillQuery.clone().leftJoin('entity.chatterMessageDetails', 'identityDetail')
            .select('entity.coModelEntityId').distinct(true)
            .andWhere(new Brackets((where) => {
                where.where('entity.modelUserKey LIKE :agentKey')
                    .orWhere("identityDetail.fieldName = 'agentSkillKey' AND (identityDetail.oldValue LIKE :agentKey OR identityDetail.newValue LIKE :agentKey)")
                    .orWhere("identityDetail.fieldName = 'agentRegistry' AND (identityDetail.oldValue = :agentValue OR identityDetail.newValue = :agentValue)");
                if (currentLinkIds.length) where.orWhere('entity.coModelEntityId IN (:...currentLinkIds)', { currentLinkIds });
            })).setParameters({ agentKey: `${agentId}:%`, agentValue: String(agentId) });
        const agentSkillEntries = await agentSkillQuery.innerJoin('entity.chatterMessageDetails', 'detail')
            .andWhere(`entity.coModelEntityId IN (${linkIdsQuery.getQuery()})`).setParameters(linkIdsQuery.getParameters())
            .andWhere('detail.fieldName IN (:...linkFields)', { linkFields: ['agentRegistry', 'agentSkillRegistry', 'agentSkillKey', 'alwaysInclude'] })
            .select('entity.id', 'messageId').addSelect('entity.coModelEntityId', 'agentSkillId')
            .addSelect('entity.messageSubType', 'eventType').addSelect('entity.modelUserKey', 'agentSkillKey')
            .addSelect('entity.createdAt', 'createdAt').addSelect('detail.fieldName', 'fieldName')
            .addSelect('detail.oldValue', 'oldValue').addSelect('detail.newValue', 'newValue')
            .orderBy('entity.createdAt', 'ASC').addOrderBy('entity.id', 'ASC').addOrderBy('detail.id', 'ASC')
            .getRawMany();

        const skillIdsByLink = new Map<number, Set<number>>(currentAgentSkills.map((link) => [link.id, new Set([link.agentSkillRegistry.id])]));
        const skillIdsByMessage = new Map<number, Set<number>>();
        for (const entry of agentSkillEntries) {
            entry.messageId = Number(entry.messageId);
            entry.agentSkillId = Number(entry.agentSkillId);
            entry.createdAt = LocalDateTimeTransformer.from(entry.createdAt);
            const skillIds = skillIdsByMessage.get(entry.messageId) ?? new Set<number>();
            for (const key of [entry.agentSkillKey, ...(entry.fieldName === 'agentSkillKey' ? [entry.oldValue, entry.newValue] : [])]) {
                if (typeof key === 'string' && /^[1-9]\d*:[1-9]\d*$/.test(key) && Number(key.split(':')[0]) === agentId) {
                    const id = Number(key.split(':')[1]);
                    if (Number.isSafeInteger(id)) skillIds.add(id);
                }
            }
            if (entry.fieldName === 'agentSkillRegistry') {
                for (const value of [entry.oldValue, entry.newValue]) {
                    const id = Number(value);
                    if (Number.isSafeInteger(id) && id > 0) skillIds.add(id);
                }
            }
            skillIdsByMessage.set(entry.messageId, skillIds);
            const linkSkills = skillIdsByLink.get(entry.agentSkillId) ?? new Set<number>();
            for (const id of skillIds) linkSkills.add(id);
            skillIdsByLink.set(entry.agentSkillId, linkSkills);
        }
        // 6. Fetch skill names for the rows. Skill names are immutable.
        const skillIds = [...new Set([...skillIdsByLink.values()].flatMap((ids) => [...ids]))];
        const agentSkillRegistryRecords = skillIds.length ? await this.moduleRef.get(AgentSkillRegistryRepository, { strict: false }).find({
            where: { id: In(skillIds) }, withDeleted: true, select: { id: true, name: true },
        }) : [];

        // 7. Resolve each skill from its latest association event at each version date.
        const leftSkills = new Map<number, { alwaysInclude: boolean }>();
        const rightSkills = new Map<number, { alwaysInclude: boolean }>();
        for (const skillId of skillIds) {
            const history = agentSkillEntries.filter((entry) => skillIdsByLink.get(entry.agentSkillId)?.has(skillId));
            const lifecycle = history.filter((entry) => entry.eventType === 'audit_insert' || entry.eventType === 'audit_delete');
            const settings = history.filter((entry) => entry.fieldName === 'alwaysInclude');
            const currentLinks = currentAgentSkills.filter((link) => link.agentSkillRegistry.id === skillId);
            for (const [at, destination] of [[older.createdAt, leftSkills], [newer.createdAt, rightSkills]] as const) {
                const previous = lifecycle.filter((entry) => entry.createdAt <= at);
                const latest = previous[previous.length - 1];
                const current = currentLinks.find((link) => link.createdAt <= at && (!link.deletedAt || link.deletedAt > at));
                const present = latest ? latest.eventType === 'audit_insert'
                    : lifecycle.length ? lifecycle[0].eventType === 'audit_delete' : Boolean(current);
                if (!present) continue;

                const previousSettings = settings.filter((entry) => entry.createdAt <= at);
                const alwaysInclude = previousSettings.length ? previousSettings[previousSettings.length - 1].newValue
                    : settings.length ? settings[0].oldValue : current?.alwaysInclude ?? true;
                destination.set(skillId, { alwaysInclude: [true, 'true', 1, '1'].includes(alwaysInclude) });
            }
        }

        // 8. Check body history only for skills present in both versions.
        const sharedSkillIds = [...leftSkills.keys()].filter((id) => rightSkills.has(id));
        const changedSkillIds = new Set<number>();
        if (sharedSkillIds.length) {
            const bodyQuery = await chatter.createSecurityRuleAwareQueryBuilder('entity');
            const bodyChanges = await bodyQuery.innerJoin('entity.chatterMessageDetails', 'detail')
                .andWhere('entity.messageType = :messageType', { messageType: 'audit' })
                .andWhere('entity.coModelName = :modelName', { modelName: 'agentSkillRegistry' })
                .andWhere('entity.coModelEntityId IN (:...skillIds)', { skillIds: sharedSkillIds })
                .andWhere('entity.createdAt > :start AND entity.createdAt <= :end', {
                    start: LocalDateTimeTransformer.to(older.createdAt), end: LocalDateTimeTransformer.to(newer.createdAt),
                })
                .andWhere('detail.fieldName = :field', { field: 'body' })
                .select('entity.coModelEntityId', 'skillId')
                .distinct(true)
                .getRawMany();
            for (const entry of bodyChanges) changedSkillIds.add(Number(entry.skillId));
        }

        // 9. Build one UI row per catalog skill.
        const catalogSkills = new Map(agentSkillRegistryRecords.map((skill) => [skill.id, skill]));
        const skillRows = [];
        for (const skillId of [...new Set([...leftSkills.keys(), ...rightSkills.keys()])].sort((a, b) => a - b)) {
            const left = leftSkills.get(skillId);
            const right = rightSkills.get(skillId);
            const status = !left ? 'added' : !right ? 'removed'
                : left.alwaysInclude !== right.alwaysInclude || changedSkillIds.has(skillId) ? 'changed' : 'matched';
            const sides = [left, right].map((link) => {
                if (!link) return null;
                const name = catalogSkills.get(skillId)?.name;
                return { label: String(name || `Skill ${skillId}`), summary: link.alwaysInclude ? 'Always included' : 'Loaded on demand' };
            });
            skillRows.push({ id: String(skillId), status, diffKey: status === 'matched' ? null : `skill:${skillId}`, left: sides[0], right: sides[1] });
        }

        // 10. Resolve the reasoning and fast model values at both version dates.
        const groups = [];
        for (const [id, title, field] of [
            ['reasoning', 'Reasoning model configuration', 'reasoningModelKey'],
            ['fast', 'Fast model configuration', 'fastModelKey'],
        ]) {
            const history = agentRegistryChanges[field];
            const values = [older.createdAt, newer.createdAt].map((at) => {
                const before = history.filter((entry) => entry.createdAt <= at);
                const value = before.length ? before[before.length - 1].newValue : history.length ? history[0].oldValue : agent[field];
                const key = String(value ?? '');
                const separator = key.indexOf(':');
                return separator < 0 ? ['', key] : [key.slice(0, separator), key.slice(separator + 1)];
            });
            const changed = history.some((entry) => entry.createdAt > older.createdAt && entry.createdAt <= newer.createdAt);
            groups.push({ id, title, status: changed ? 'changed' : 'matched',
                fields: ['Provider', 'Model'].map((label, index) => ({ key: label.toLowerCase(), label,
                    status: values[0][index] !== values[1][index] || (index === 1 && changed) ? 'changed' : 'matched',
                    left: values[0][index] || null, right: values[1][index] || null })),
            });
        }

        const toolRows = await this.getToolComparison(agentId, older.createdAt, newer.createdAt);

        // 11. Return the UI contract without loading persona or skill content.
        const headers = versions.map((version) => ({ id: version.id, versionNumber: version.versionNumber,
            name: version.name ?? null, description: version.description ?? null, createdAt: version.createdAt.toISOString() }));
        return { schemaVersion: 1, agent: { id: agent.id, name: agent.name, title: agent.title },
            versions: { left: headers[0], right: headers[1] },
            sections: {
                systemPrompt: { title: 'System prompt', status: promptChanged ? 'changed' : 'matched', diffKey: promptChanged ? 'systemPrompt' : null,
                    left: { label: 'System prompt', summary: promptChanged ? 'Previous instructions' : 'No recorded changes' },
                    right: { label: 'System prompt', summary: promptChanged ? 'Updated instructions' : 'No recorded changes' } },
                skills: { title: 'Skills', status: skillRows.some((row) => row.status !== 'matched') ? 'changed' : 'matched', rows: skillRows },
                tools: { title: 'Tools', status: toolRows.some((row) => row.status !== 'matched') ? 'changed' : 'matched', rows: toolRows },
                generalConfiguration: compareAgentGeneralConfig(agent as unknown as Record<string, unknown>,
                    Object.values(agentRegistryChanges).flat(), older.createdAt, newer.createdAt),
                modelConfiguration: { title: 'Model configuration', status: groups.some((group) => group.status === 'changed') ? 'changed' : 'matched', groups },
            },
        };
    }

    private async getToolComparison(agentId: number, older: Date, newer: Date) {
        const chatter = this.moduleRef.get(ChatterMessageRepository, { strict: false });
        const links = await this.moduleRef.get(AgentToolRepository, { strict: false }).find({
            where: { agentRegistry: { id: agentId } }, withDeleted: true,
            relations: { agentToolRegistry: true },
            select: { id: true, createdAt: true, deletedAt: true, requiresApproval: true, agentToolRegistry: { id: true } },
        });
        const currentIds = links.map((link) => link.id);
        const query = await chatter.createSecurityRuleAwareQueryBuilder('entity');
        query.andWhere('entity.messageType = :messageType', { messageType: 'audit' })
            .andWhere('entity.coModelName = :modelName', { modelName: 'agentTool' });
        // Include historical, deleted and reassigned links, plus updates without a user key.
        const identities = query.clone().leftJoin('entity.chatterMessageDetails', 'identityDetail')
            .select('entity.coModelEntityId').distinct(true)
            .andWhere(new Brackets((where) => {
                where.where('entity.modelUserKey LIKE :agentKey')
                    .orWhere("identityDetail.fieldName = 'agentToolKey' AND (identityDetail.oldValue LIKE :agentKey OR identityDetail.newValue LIKE :agentKey)")
                    .orWhere("identityDetail.fieldName = 'agentRegistry' AND (identityDetail.oldValue = :agentValue OR identityDetail.newValue = :agentValue)");
                if (currentIds.length) where.orWhere('entity.coModelEntityId IN (:...currentIds)', { currentIds });
            })).setParameters({ agentKey: `${agentId}:%`, agentValue: String(agentId) });
        const raw = await query.leftJoin('entity.chatterMessageDetails', 'detail')
            .andWhere(`entity.coModelEntityId IN (${identities.getQuery()})`).setParameters(identities.getParameters())
            .select('entity.id', 'messageId').addSelect('entity.coModelEntityId', 'linkId')
            .addSelect('entity.messageSubType', 'eventType').addSelect('entity.modelUserKey', 'key')
            .addSelect('entity.createdAt', 'createdAt').addSelect('detail.fieldName', 'fieldName')
            .addSelect('detail.oldValue', 'oldValue').addSelect('detail.newValue', 'newValue')
            .orderBy('entity.createdAt', 'ASC').addOrderBy('entity.id', 'ASC').addOrderBy('detail.id', 'ASC').getRawMany();
        const entries: ToolLinkAudit[] = raw.map((entry) => ({ ...entry, messageId: Number(entry.messageId), linkId: Number(entry.linkId), createdAt: LocalDateTimeTransformer.from(entry.createdAt) }));
        const current = links.map((link) => ({ ...link, agentId, toolId: link.agentToolRegistry.id }));
        const left = toolLinksAt(agentId, older, current, entries);
        const right = toolLinksAt(agentId, newer, current, entries);
        const ids = [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a - b);
        if (!ids.length) return [];
        const catalog = await this.moduleRef.get(AgentToolRegistryRepository, { strict: false }).find({
            where: { id: In(ids) }, withDeleted: true, select: { id: true, name: true },
        });
        const catalogQuery = await chatter.createSecurityRuleAwareQueryBuilder('entity');
        // Only names are loaded here; source and other values are fetched on demand.
        const changes = await catalogQuery.innerJoin('entity.chatterMessageDetails', 'detail')
            .andWhere('entity.messageType = :messageType', { messageType: 'audit' })
            .andWhere('entity.coModelName = :modelName', { modelName: 'agentToolRegistry' })
            .andWhere('entity.coModelEntityId IN (:...ids)', { ids })
            .andWhere('detail.fieldName IN (:...fields)', { fields: Object.keys(TOOL_COMPARISON_FIELDS) })
            .select('entity.coModelEntityId', 'toolId').addSelect('entity.createdAt', 'createdAt')
            .addSelect('detail.fieldName', 'fieldName')
            .addSelect("CASE WHEN detail.fieldName = 'name' THEN detail.oldValue ELSE NULL END", 'oldValue')
            .addSelect("CASE WHEN detail.fieldName = 'name' THEN detail.newValue ELSE NULL END", 'newValue')
            .orderBy('entity.createdAt', 'ASC').addOrderBy('entity.id', 'ASC').addOrderBy('detail.id', 'ASC').getRawMany();
        for (const entry of changes) entry.createdAt = LocalDateTimeTransformer.from(entry.createdAt);
        return ids.map((id) => {
            const before = left.get(id), after = right.get(id);
            const history = changes.filter((entry) => Number(entry.toolId) === id);
            const changed = history.some((entry) => entry.createdAt > older && entry.createdAt <= newer);
            const status = !before ? 'added' : !after ? 'removed' : changed || before.requiresApproval !== after.requiresApproval ? 'changed' : 'matched';
            const sides = [before, after].map((link, index) => link ? {
                label: toolFieldAt(history, 'name', index === 0 ? older : newer, catalog.find((tool) => tool.id === id)?.name) || `Tool ${id}`,
                summary: link.requiresApproval ? 'Requires approval' : 'No approval required',
            } : null);
            return { id: String(id), status, diffKey: status === 'matched' ? null : `tool:${id}`, left: sides[0], right: sides[1] };
        });
    }

    async getComparisonDiff(agentId: number, leftVersionId: number, rightVersionId: number, diffKey = 'systemPrompt') {
        const skillId = /^skill:[1-9]\d*$/.test(diffKey) ? Number(diffKey.slice(6)) : null;
        const toolId = /^tool:[1-9]\d*$/.test(diffKey) ? Number(diffKey.slice(5)) : null;
        if (diffKey !== 'systemPrompt' && ![skillId, toolId].some((id) => Number.isSafeInteger(id) && id > 0)) {
            throw new BadRequestException('Provide systemPrompt, skill:<id>, or tool:<id> as the diff key.');
        }

        // 1. Reuse the same access checks, version ownership and date ordering.
        const comparison = await this.getComparison(agentId, leftVersionId, rightVersionId);
        const { left, right } = comparison.versions;

        if (toolId !== null) {
            const row = comparison.sections.tools.rows.find((item) => item.id === String(toolId));
            if (!row || row.status === 'matched') throw new NotFoundException('There are no recorded changes for this tool in the comparison.');
            const query = await this.moduleRef.get(ChatterMessageRepository, { strict: false }).createSecurityRuleAwareQueryBuilder('entity');
            const [rawEntries, tool] = await Promise.all([
                query.innerJoin('entity.chatterMessageDetails', 'detail')
                    .andWhere('entity.messageType = :messageType', { messageType: 'audit' })
                    .andWhere('entity.coModelName = :modelName', { modelName: 'agentToolRegistry' })
                    .andWhere('entity.coModelEntityId = :toolId', { toolId })
                    .andWhere('detail.fieldName IN (:...fields)', { fields: Object.keys(TOOL_COMPARISON_FIELDS) })
                    .select('entity.createdAt', 'createdAt').addSelect('detail.fieldName', 'fieldName')
                    .addSelect('detail.oldValue', 'oldValue').addSelect('detail.newValue', 'newValue')
                    .orderBy('entity.createdAt', 'ASC').addOrderBy('entity.id', 'ASC').addOrderBy('detail.id', 'ASC').getRawMany(),
                this.moduleRef.get(AgentToolRegistryRepository, { strict: false }).findOne({
                    where: { id: toolId }, withDeleted: true, relations: { module: true, tags: true },
                }),
            ]);
            if (!tool && !rawEntries.length) throw new NotFoundException('The historical configuration for this tool is unavailable.');
            const entries = rawEntries.map((entry) => ({ ...entry, createdAt: LocalDateTimeTransformer.from(entry.createdAt) }));
            const settings = [row.left, row.right].map((side) => side ? String(side.summary === 'Requires approval') : '');
            const rows = [{ id: 'requiresApproval', title: 'Requires approval', oldValue: settings[0], newValue: settings[1] }];
            for (const [field, title] of Object.entries(TOOL_COMPARISON_FIELDS)) {
                const fallback = field === 'module' ? tool?.module?.id : field === 'tags' ? tool?.tags?.map((tag) => tag.id).join(', ') : tool?.[field];
                const values = [left, right].map((version, index) => (index === 0 ? row.left : row.right)
                    ? toolFieldAt(entries, field, new Date(version.createdAt), fallback) : '');
                const changed = entries.some((entry) => entry.fieldName === field && entry.createdAt > new Date(left.createdAt) && entry.createdAt <= new Date(right.createdAt));
                if (changed || values[0] !== values[1]) rows.push({ id: field, title, oldValue: values[0], newValue: values[1] });
            }
            return { diffKey, title: row.right?.label || row.left?.label || `Tool ${toolId}`, language: 'text', oldValue: '', newValue: '', rows };
        }

        if (skillId !== null) {
            // 2. Only expose skills included in this comparison with recorded changes.
            const row = comparison.sections.skills.rows.find((item) => item.id === String(skillId));
            if (!row || row.status === 'matched') {
                throw new NotFoundException('There are no recorded changes for this skill in the comparison.');
            }

            // 3. Fetch body history, including later edits needed to resolve historical values.
            const chatter = this.moduleRef.get(ChatterMessageRepository, { strict: false });
            const query = await chatter.createSecurityRuleAwareQueryBuilder('entity');
            const [entries, skill] = await Promise.all([
                query.innerJoin('entity.chatterMessageDetails', 'detail')
                    .andWhere('entity.messageType = :messageType', { messageType: 'audit' })
                    .andWhere('entity.coModelName = :modelName', { modelName: 'agentSkillRegistry' })
                    .andWhere('entity.coModelEntityId = :skillId', { skillId })
                    .andWhere('detail.fieldName = :field', { field: 'body' })
                    .select('entity.createdAt', 'createdAt')
                    .addSelect('detail.oldValue', 'oldValue').addSelect('detail.newValue', 'newValue')
                    .orderBy('entity.createdAt', 'ASC').addOrderBy('entity.id', 'ASC').addOrderBy('detail.id', 'ASC')
                    .getRawMany(),
                this.moduleRef.get(AgentSkillRegistryRepository, { strict: false }).findOne({
                    where: { id: skillId }, withDeleted: true, select: { id: true, body: true },
                }),
            ]);
            if (!skill && !entries.length) {
                throw new NotFoundException('The historical body for this skill is unavailable.');
            }
            for (const entry of entries) entry.createdAt = LocalDateTimeTransformer.from(entry.createdAt);

            // 4. Return two split rows; an absent association leaves its side empty.
            const bodies = [left, right].map((version, index) => {
                if (!(index === 0 ? row.left : row.right)) return '';
                const before = entries.filter((entry) => entry.createdAt <= new Date(version.createdAt));
                return String((before.length ? before[before.length - 1].newValue : entries.length ? entries[0].oldValue : skill.body) ?? '');
            });
            const settings = [row.left, row.right].map((side) => side ? String(side.summary === 'Always included') : '');
            return { diffKey, title: row.right?.label || row.left?.label || `Skill ${skillId}`, language: 'markdown',
                oldValue: bodies[0], newValue: bodies[1],
                rows: [
                    { id: 'alwaysInclude', title: 'Always include', oldValue: settings[0], newValue: settings[1] },
                    { id: 'body', title: 'Skill body', oldValue: bodies[0], newValue: bodies[1] },
                ],
            };
        }

        // 2. Fetch actual persona values only when its diff is requested.
        const chatter = this.moduleRef.get(ChatterMessageRepository, { strict: false });
        const query = await chatter.createSecurityRuleAwareQueryBuilder('entity');
        const entries = await query.innerJoin('entity.chatterMessageDetails', 'detail')
            .andWhere('entity.messageType = :messageType', { messageType: 'audit' })
            .andWhere('entity.coModelName = :modelName', { modelName: 'agentRegistry' })
            .andWhere('entity.coModelEntityId = :agentId', { agentId })
            .andWhere('entity.createdAt > :start', { start: LocalDateTimeTransformer.to(new Date(left.createdAt)) })
            .andWhere('entity.createdAt <= :end', { end: LocalDateTimeTransformer.to(new Date(right.createdAt)) })
            .andWhere('detail.fieldName = :field', { field: 'systemPrompt' })
            .select('detail.oldValue', 'oldValue').addSelect('detail.newValue', 'newValue')
            .orderBy('entity.createdAt', 'ASC').addOrderBy('entity.id', 'ASC').addOrderBy('detail.id', 'ASC')
            .getRawMany();
        if (!entries.length) throw new NotFoundException('There are no recorded system prompt changes between these versions.');

        // 3. Collapse multiple edits into the first old value and final new value.
        return { diffKey, title: 'System prompt', language: 'markdown',
            oldValue: entries[0].oldValue ?? '', newValue: entries[entries.length - 1].newValue ?? '' };
    }
}
