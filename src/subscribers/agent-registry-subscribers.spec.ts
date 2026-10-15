import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { AgentRegistry } from '../entities/agent-registry.entity';
import { AgentHubTag } from '../entities/agent-hub-tag.entity';
import { AgentSkill } from '../entities/agent-skill.entity';
import { AgentSkillRegistry } from '../entities/agent-skill-registry.entity';
import { AgentTool } from '../entities/agent-tool.entity';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { ModuleMetadataHelperService } from '../helpers/module-metadata-helper.service';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';
import { AgentToolRegistrySubscriber } from './agent-tool-registry.subscriber';
import { AgentSkillRegistrySubscriber } from './agent-skill-registry.subscriber';
import { AgentHubTagSubscriber } from './agent-hub-tag.subscriber';
import { AgentSkillSubscriber } from './agent-skill.subscriber';
import { AgentToolSubscriber } from './agent-tool.subscriber';

describe('AgentHub registry subscribers', () => {
    it('keeps digits in module metadata paths', async () => {
        const helper = new ModuleMetadataHelperService({} as any);
        expect(await helper.getModuleMetadataFilePath('thing7-agent-registry')).toBe(
            path.resolve(process.cwd(), 'src/thing7-agent-registry/metadata/thing7-agent-registry-metadata.json'),
        );
    });

    it.each(['afterInsert', 'afterUpdate'] as const)('writes tag, agent, tool, and skill fields on %s', async (hook) => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agenthub-metadata-'));
        const file = path.join(directory, 'thing7-agent-registry-metadata.json');
        try {
            await fs.writeFile(file, JSON.stringify({
                agenthubTags: hook === 'afterUpdate' ? [{ name: 'research' }] : [],
                agenthubAgents: hook === 'afterUpdate' ? [{
                    name: 'assistant',
                    tags: ['old'],
                    agentSkills: [{ name: 'research', alwaysInclude: true }],
                    agentTools: [{ name: 'search', requiresApproval: false }],
                }] : [],
                agenthubTools: hook === 'afterUpdate' ? [{ name: 'search', tags: ['old'] }] : [],
                agenthubSkills: hook === 'afterUpdate' ? [{ name: 'research', tags: ['old'] }] : [],
            }));
            const helper = {
                getModuleMetadataFilePath: async () => file,
                getModuleMetadataConfiguration: async () => JSON.parse(await fs.readFile(file, 'utf8')),
            };
            const rows = new Map<any, any>([
                [AgentHubTag, { name: 'research' }],
                [AgentRegistry, {
                    name: 'assistant', title: 'Assistant', systemPrompt: 'Updated persona', requiredInputs: '[]',
                    reasoningModelKey: 'provider:reasoning', fastModelKey: 'provider:fast', status: 'draft',
                    stepLimit: 100, turnStepLimit: 20, costLimit: 3,
                }],
                [AgentToolRegistry, { name: 'search', type: 'custom', sourceCode: 'print(1)', checksum: 'abc', status: 'inactive' }],
                [AgentSkillRegistry, { name: 'research', type: 'custom', body: '# Updated skill' }],
            ]);
            const manager = { getRepository: (target: any) => ({ findOne: async () => ({ ...rows.get(target), module: { name: 'thing7-agent-registry' }, tags: [{ name: 'new' }] }) }) };
            for (const [target, Subscriber] of [
                [AgentHubTag, AgentHubTagSubscriber],
                [AgentRegistry, AgentRegistrySubscriber],
                [AgentToolRegistry, AgentToolRegistrySubscriber],
                [AgentSkillRegistry, AgentSkillRegistrySubscriber],
            ] as const) {
                const subscriber = new Subscriber({ subscribers: [] } as any, helper as any);
                await subscriber[hook]({ entity: { id: 1 }, metadata: { target }, manager } as any);
            }
            const metadata = JSON.parse(await fs.readFile(file, 'utf8'));
            expect(metadata.agenthubTags).toEqual([{ name: 'research', moduleUserKey: 'thing7-agent-registry' }]);
            expect(metadata.agenthubAgents[0].systemPrompt).toBe('Updated persona');
            if (hook === 'afterUpdate') {
                expect(metadata.agenthubAgents[0].agentSkills).toEqual([{ name: 'research', alwaysInclude: true }]);
                expect(metadata.agenthubAgents[0].agentTools).toEqual([{ name: 'search', requiresApproval: false }]);
            }
            expect(metadata.agenthubTools[0].sourceCode).toBe('print(1)');
            expect(metadata.agenthubSkills[0].body).toBe('# Updated skill');
            expect(metadata.agenthubAgents[0].tags).toEqual(['new']);
            expect(metadata.agenthubTools[0].tags).toEqual(['new']);
            expect(metadata.agenthubSkills[0].tags).toEqual(['new']);
        } finally {
            await fs.rm(directory, { recursive: true, force: true });
        }
    });

    it.each([
        [AgentRegistry, AgentRegistrySubscriber, 'agenthubAgents'],
        [AgentToolRegistry, AgentToolRegistrySubscriber, 'agenthubTools'],
        [AgentSkillRegistry, AgentSkillRegistrySubscriber, 'agenthubSkills'],
    ] as const)('removes the last tag from %s metadata', async (entity, Subscriber, key) => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agenthub-tags-'));
        const file = path.join(directory, 'module-metadata.json');
        try {
            await fs.writeFile(file, JSON.stringify({ [key]: [{ name: 'example', tags: ['old'] }] }));
            const helper = {
                getModuleMetadataFilePath: async () => file,
                getModuleMetadataConfiguration: async () => JSON.parse(await fs.readFile(file, 'utf8')),
            };
            const manager = { getRepository: () => ({ findOne: async () => ({
                name: 'example', module: { name: 'example-module' }, tags: [], costLimit: 3,
            }) }) };
            const subscriber = new Subscriber({ subscribers: [] } as any, helper as any);
            await subscriber.afterUpdate({ entity: { id: 1 }, manager } as any);
            expect(JSON.parse(await fs.readFile(file, 'utf8'))[key][0].tags).toEqual([]);
        } finally {
            await fs.rm(directory, { recursive: true, force: true });
        }
    });

    it('syncs agent skill and tool links by name, including removal', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agenthub-links-'));
        const file = path.join(directory, 'module-metadata.json');
        try {
            await fs.writeFile(file, JSON.stringify({ agenthubAgents: [{ name: 'assistant' }] }));
            const helper = {
                getModuleMetadataFilePath: async () => file,
                getModuleMetadataConfiguration: async () => JSON.parse(await fs.readFile(file, 'utf8')),
            };
            const links = new Map<any, any[]>([
                [AgentSkill, [
                    { agentSkillRegistry: { name: 'writing' }, alwaysInclude: true },
                    { agentSkillRegistry: { name: 'research' }, alwaysInclude: false },
                ]],
                [AgentTool, [{ agentToolRegistry: { name: 'search' }, requiresApproval: true }]],
            ]);
            const manager = {
                getRepository: (entity: any) => entity === AgentRegistry
                    ? { findOne: async () => ({ name: 'assistant', module: { name: 'example-module' } }) }
                    : { find: async () => links.get(entity) },
            };
            const subscriber = new AgentRegistrySubscriber({ subscribers: [] } as any, helper as any);

            await subscriber.syncAgentSkills(1, manager as any);
            await subscriber.syncAgentTools(1, manager as any);
            let metadata = JSON.parse(await fs.readFile(file, 'utf8'));
            expect(metadata.agenthubAgents[0].agentSkills).toEqual([
                { name: 'research', alwaysInclude: false },
                { name: 'writing', alwaysInclude: true },
            ]);
            expect(metadata.agenthubAgents[0].agentTools).toEqual([
                { name: 'search', requiresApproval: true },
            ]);

            links.set(AgentSkill, []);
            await subscriber.syncAgentSkills(1, manager as any);
            metadata = JSON.parse(await fs.readFile(file, 'utf8'));
            expect(metadata.agenthubAgents[0].agentSkills).toEqual([]);
        } finally {
            await fs.rm(directory, { recursive: true, force: true });
        }
    });

});
