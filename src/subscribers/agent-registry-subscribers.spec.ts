import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { AgentRegistry } from '../entities/agent-registry.entity';
import { AgentSkillRegistry } from '../entities/agent-skill-registry.entity';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { ModuleMetadataHelperService } from '../helpers/module-metadata-helper.service';
import { AgentRegistrySubscriber } from './agent-registry.subscriber';
import { AgentToolRegistrySubscriber } from './agent-tool-registry.subscriber';
import { AgentSkillRegistrySubscriber } from './agent-skill-registry.subscriber';

describe('AgentHub registry subscribers', () => {
    it('keeps digits in module metadata paths', async () => {
        const helper = new ModuleMetadataHelperService({} as any);
        expect(await helper.getModuleMetadataFilePath('thing7-agent-registry')).toBe(
            path.resolve(process.cwd(), 'src/thing7-agent-registry/metadata/thing7-agent-registry-metadata.json'),
        );
    });

    it.each(['afterInsert', 'afterUpdate'] as const)('writes agent, tool, and skill fields on %s', async (hook) => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agenthub-metadata-'));
        const file = path.join(directory, 'thing7-agent-registry-metadata.json');
        try {
            await fs.writeFile(file, JSON.stringify({
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
                [AgentRegistry, {
                    name: 'assistant', title: 'Assistant', systemPrompt: 'Updated persona', requiredInputs: '[]',
                    reasoningModelKey: 'provider:reasoning', fastModelKey: 'provider:fast', status: 'draft',
                    stepLimit: 100, turnStepLimit: 20, costLimit: 3,
                }],
                [AgentToolRegistry, { name: 'search', type: 'custom', sourceCode: 'print(1)', checksum: 'abc', status: 'inactive' }],
                [AgentSkillRegistry, { name: 'research', type: 'custom', body: '# Updated skill' }],
            ]);
            const manager = { getRepository: (target: any) => ({ findOne: async () => ({ ...rows.get(target), module: { name: 'thing7-agent-registry' }, tags: [] }) }) };
            for (const [target, Subscriber] of [
                [AgentRegistry, AgentRegistrySubscriber],
                [AgentToolRegistry, AgentToolRegistrySubscriber],
                [AgentSkillRegistry, AgentSkillRegistrySubscriber],
            ] as const) {
                const subscriber = new Subscriber({ subscribers: [] } as any, helper as any);
                await subscriber[hook]({ entity: { id: 1 }, metadata: { target }, manager } as any);
            }
            const metadata = JSON.parse(await fs.readFile(file, 'utf8'));
            expect(metadata.agenthubAgents[0].systemPrompt).toBe('Updated persona');
            if (hook === 'afterUpdate') {
                expect(metadata.agenthubAgents[0].agentSkills).toEqual([{ name: 'research', alwaysInclude: true }]);
                expect(metadata.agenthubAgents[0].agentTools).toEqual([{ name: 'search', requiresApproval: false }]);
            }
            expect(metadata.agenthubTools[0].sourceCode).toBe('print(1)');
            expect(metadata.agenthubSkills[0].body).toBe('# Updated skill');
            expect(metadata.agenthubAgents[0]).not.toHaveProperty('tags');
            expect(metadata.agenthubTools[0]).not.toHaveProperty('tags');
            expect(metadata.agenthubSkills[0]).not.toHaveProperty('tags');
        } finally {
            await fs.rm(directory, { recursive: true, force: true });
        }
    });
});
