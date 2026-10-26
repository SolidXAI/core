import { AgentRegistry } from '../entities/agent-registry.entity';
import { AgentHubTag } from '../entities/agent-hub-tag.entity';
import { AgentSkill } from '../entities/agent-skill.entity';
import { AgentSkillRegistry } from '../entities/agent-skill-registry.entity';
import { AgentTool } from '../entities/agent-tool.entity';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { ModuleMetadataSeederService } from './module-metadata-seeder.service';

describe('AgentHub metadata seeding', () => {
    it('seeds tags, skills, tools, then agents', async () => {
        const seeder = Object.create(ModuleMetadataSeederService.prototype) as any;
        const order: string[] = [];
        seeder.getSeedArray = (records: any[]) => records;
        seeder.getModuleByUserKeyCached = async () => ({ id: 1, name: 'example' });
        seeder.seedAgentHubTags = async () => { order.push('tags'); return 1; };
        seeder.seedAgentHubSkills = async () => { order.push('skills'); return 1; };
        seeder.seedAgentHubTools = async () => { order.push('tools'); return 1; };
        seeder.seedAgentHubAgents = async () => { order.push('agents'); return 1; };

        await seeder.seedAgentHubRegistries({
            moduleMetadata: { name: 'example' },
            agenthubTags: [{}], agenthubSkills: [{}], agenthubTools: [{}], agenthubAgents: [{}],
        });

        expect(order).toEqual(['tags', 'skills', 'tools', 'agents']);
    });

    it('creates tags with their module and links existing tags without replacing their data', async () => {
        const seeder = Object.create(ModuleMetadataSeederService.prototype) as any;
        const module = { id: 1, name: 'example' };
        const rows = new Map<string, any>([['existing', { id: 2, name: 'existing', module: null }]]);
        const repo = {
            findOne: async ({ where }: any) => rows.get(where.name),
            update: async (id: number, changes: any) => {
                const row = [...rows.values()].find((item) => item.id === id);
                Object.assign(row, changes);
            },
            create: (value: any) => value,
            save: async (value: any) => { rows.set(value.name, value); return value; },
        };
        seeder.dataSource = { getRepository: (entity: any) => entity === AgentHubTag ? repo : undefined };
        seeder.getAgentHubSeedModule = async () => module;

        const count = await seeder.seedAgentHubTags([
            { name: 'existing', moduleUserKey: 'example' },
            { name: 'new', moduleUserKey: 'example' },
        ], module);

        expect(count).toBe(2);
        expect(rows.get('existing').module).toBe(module);
        expect(rows.get('new')).toEqual({ name: 'new', module });
    });

    it('sets tag relations on existing skills, tools, and agents by tag name', async () => {
        const seeder = Object.create(ModuleMetadataSeederService.prototype) as any;
        const module = { id: 1, name: 'example' };
        const tag = { id: 10, name: 'research' };
        const rows = new Map<any, any>([
            [AgentSkillRegistry, { id: 2, name: 'skill', module, tags: [] }],
            [AgentToolRegistry, { id: 3, name: 'tool', module, tags: [] }],
            [AgentRegistry, { id: 4, name: 'agent', module, tags: [] }],
        ]);
        const registryRepo = (entity: any) => ({
            findOne: async () => rows.get(entity),
            save: async (row: any) => { rows.set(entity, row); return row; },
        });
        seeder.dataSource = { getRepository: (entity: any) => entity === AgentHubTag
            ? { findOneBy: async ({ name }: any) => name === tag.name ? tag : null }
            : registryRepo(entity) };
        seeder.getAgentHubSeedModule = async () => module;

        await seeder.seedAgentHubSkills([{ name: 'skill', tags: ['research'] }], module);
        await seeder.seedAgentHubTools([{ name: 'tool', tags: ['research'] }], module);
        await seeder.seedAgentHubAgents([{ name: 'agent', tags: ['research'] }], module);

        for (const entity of [AgentSkillRegistry, AgentToolRegistry, AgentRegistry]) {
            expect(rows.get(entity).tags).toEqual([tag]);
        }
    });

    it('links an existing agent by registry names without duplicating links', async () => {
        const seeder = Object.create(ModuleMetadataSeederService.prototype) as any;
        const module = { id: 1, name: 'example' };
        const agent = { id: 2, name: 'assistant', module };
        const skill = { id: 3, name: 'research' };
        const tool = { id: 4, name: 'search' };
        const skillLinks: any[] = [];
        const toolLinks: any[] = [];
        const agentRepo = { findOne: async () => agent };
        const skillRepo = { findOneBy: async () => skill };
        const toolRepo = { findOneBy: async () => tool };
        const agentSkillRepo = {
            findOneBy: async () => skillLinks[0],
            create: (value: any) => value,
            save: async (value: any) => { skillLinks.push(value); return value; },
        };
        const agentToolRepo = {
            findOneBy: async () => toolLinks[0],
            create: (value: any) => value,
            save: async (value: any) => { toolLinks.push(value); return value; },
        };
        const repositories = new Map<any, any>([
            [AgentRegistry, agentRepo], [AgentSkillRegistry, skillRepo], [AgentToolRegistry, toolRepo],
            [AgentSkill, agentSkillRepo], [AgentTool, agentToolRepo],
        ]);
        seeder.dataSource = { getRepository: (entity: any) => repositories.get(entity) };
        seeder.getAgentHubSeedModule = async () => module;
        const records = [{
            name: 'assistant',
            agentSkills: [{ name: 'research', alwaysInclude: false }],
            agentTools: [{ name: 'search', requiresApproval: true }],
        }];

        await seeder.seedAgentHubAgents(records, module);
        await seeder.seedAgentHubAgents(records, module);

        expect(skillLinks).toEqual([{ agentRegistry: agent, agentSkillRegistry: skill, alwaysInclude: false }]);
        expect(toolLinks).toEqual([{ agentRegistry: agent, agentToolRegistry: tool, requiresApproval: true }]);
    });
});
