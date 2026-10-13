import { AgentRegistry } from '../entities/agent-registry.entity';
import { AgentSkill } from '../entities/agent-skill.entity';
import { AgentSkillRegistry } from '../entities/agent-skill-registry.entity';
import { AgentTool } from '../entities/agent-tool.entity';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { ModuleMetadataSeederService } from './module-metadata-seeder.service';

describe('AgentHub metadata seeding', () => {
    it('seeds skills, tools, then agents', async () => {
        const seeder = Object.create(ModuleMetadataSeederService.prototype) as any;
        const order: string[] = [];
        seeder.getSeedArray = (records: any[]) => records;
        seeder.getModuleByUserKeyCached = async () => ({ id: 1, name: 'example' });
        seeder.seedAgentHubSkills = async () => { order.push('skills'); return 1; };
        seeder.seedAgentHubTools = async () => { order.push('tools'); return 1; };
        seeder.seedAgentHubAgents = async () => { order.push('agents'); return 1; };

        await seeder.seedAgentHubRegistries({
            moduleMetadata: { name: 'example' },
            agenthubSkills: [{}], agenthubTools: [{}], agenthubAgents: [{}],
        });

        expect(order).toEqual(['skills', 'tools', 'agents']);
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
