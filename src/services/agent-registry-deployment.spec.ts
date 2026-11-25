import { AgentRegistryService } from './agent-registry.service';

describe('agent deployment audit persistence', () => {
    let service: AgentRegistryService;
    let repository: any;
    let draftUpdate: any;
    let agent: any;
    beforeEach(() => {
        agent = { id: 1, name: 'agent', status: 'active', runner: 'docker', minProcesses: 0, maxProcesses: null, processCpu: null, processMemory: null };
        repository = { findOne: jest.fn(async () => agent), save: jest.fn(async (value) => value), update: jest.fn() };
        const toolsQuery: any = { getRawMany: async () => [] };
        for (const method of ['innerJoin', 'select', 'where']) toolsQuery[method] = () => toolsQuery;
        repository.createQueryBuilder = () => toolsQuery;
        draftUpdate = {};
        for (const method of ['update', 'set', 'whereInIds', 'andWhere']) draftUpdate[method] = jest.fn(() => draftUpdate);
        draftUpdate.execute = jest.fn(async () => { agent.status = 'draft'; });
        const manager = { getRepository: () => repository, createQueryBuilder: () => draftUpdate };
        service = Object.create(AgentRegistryService.prototype);
        Object.assign(service, { entityManager: { transaction: (callback: any) => callback(manager) } });
    });
    it('saves the identified entity so subscribers receive before/after snapshots', async () => {
        const result = await service.updateDeployment(1, { runner: 'local', processCpu: 512 });
        expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, runner: 'local', processCpu: 512 }));
        expect(repository.update).not.toHaveBeenCalled();
        expect(draftUpdate.execute).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('draft');
    });
    it('does not save or mark Draft for an unchanged deployment', async () => {
        await service.updateDeployment(1, { runner: 'docker' });
        expect(repository.save).not.toHaveBeenCalled();
        expect(draftUpdate.execute).not.toHaveBeenCalled();
    });
    it('preserves explicit resets to installation defaults', async () => {
        await service.updateDeployment(1, { runner: null, maxProcesses: null });
        expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ runner: null, maxProcesses: null, minProcesses: 0 }));
    });
});
