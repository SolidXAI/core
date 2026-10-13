import { createHash } from 'node:crypto';
import { AgentToolRegistryService } from './agent-tool-registry.service';
import { AgentConfigCatalogService } from './agent-config-version.service';

jest.mock('./agent-config-version.service', () => ({
  AgentConfigCatalogService: class {
    async create(dto: any) { return dto; }
    async createMany(dtos: any[]) { return dtos; }
    async update(id: number, dto: any) { return { id, ...dto }; }
  },
}));
jest.mock('../entities/agent-tool-registry.entity', () => ({ AgentToolRegistry: class {} }));
jest.mock('../entities/agent-tool.entity', () => ({ AgentTool: class {} }));
jest.mock('../repository/agent-tool-registry.repository', () => ({ AgentToolRegistryRepository: class {} }));

const checksum = createHash('sha256').update('saved source').digest('hex');

function fixture() {
  const row: any = { id: 1, name: 'probe', type: 'custom', sourceCode: 'saved source', checksum,
    status: 'inactive', updatedAt: new Date('2026-10-07T00:00:00Z') };
  const repo = { findOne: jest.fn(async () => ({ ...row })) };
  const transaction = { findOne: jest.fn(async () => ({ ...row })), save: jest.fn(async (_entity, saved) => saved) };
  const entityManager = { transaction: jest.fn(async (fn) => fn(transaction)) };
  const service = new AgentToolRegistryService(entityManager as any, repo as any, {} as any, {} as any);
  return { row, repo, transaction, entityManager, service };
}

afterEach(() => jest.restoreAllMocks());

it('creates new tools inactive even when active was requested', async () => {
  const { service } = fixture();
  const saved = await service.create({ type: 'custom', sourceCode: 'saved source', status: 'active' } as any);
  expect(saved.status).toBe('inactive');
  expect(saved.checksum).toBe(checksum);
});

it('creates bulk tools inactive', async () => {
  const { service } = fixture();
  const saved = await service.createMany([{ type: 'custom', sourceCode: 'saved source', status: 'active' } as any]);
  expect(saved[0].status).toBe('inactive');
});

it('allows activation through the existing update endpoint', async () => {
  const { service } = fixture();
  const saved = await service.update(1, { status: 'active', checksum } as any);
  expect(saved.status).toBe('active');
});

it('deactivates an active tool when its source changes', async () => {
  const { service, row } = fixture();
  row.status = 'active';
  const saved = await service.update(1, { sourceCode: 'changed source', status: 'active' } as any);
  expect(saved.status).toBe('inactive');
  expect(saved.checksum).toBe(createHash('sha256').update('changed source').digest('hex'));
});

it('preserves existing active tools during metadata-only saves', async () => {
  const { service, row } = fixture();
  row.status = 'active';
  const saved = await service.update(1, { description: 'Updated description', status: 'active' } as any);
  expect(saved.status).toBe('active');
});
