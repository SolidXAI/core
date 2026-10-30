import { BadRequestException } from '@nestjs/common';
import { AgentRegistryService } from './agent-registry.service';
import { RESERVED_AGENT_MODULE, RESERVED_AGENT_NAME } from '../helpers/reserved-agent.helper';

describe('AgentRegistryService protection', () => {
  let service: AgentRegistryService;
  let mockRepo: any;
  let mockEntityManager: any;
  let mockModuleRef: any;

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    mockEntityManager = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    };
    mockModuleRef = {
      get: jest.fn(),
    };
    service = new AgentRegistryService(mockEntityManager, mockRepo, mockModuleRef);
  });

  describe('create', () => {
    it('rejects creation with reserved name', async () => {
      await expect(
        service.create({ name: RESERVED_AGENT_NAME, title: 'Fake Native' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createMany', () => {
    it('rejects bulk creation containing reserved name', async () => {
      await expect(
        service.createMany([
          { name: 'custom-1', title: 'Custom 1' },
          { name: RESERVED_AGENT_NAME, title: 'Fake Native' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('rejects deletion of reserved agent', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, name: RESERVED_AGENT_NAME });
      await expect(service.delete(1)).rejects.toThrow(BadRequestException);
    });

    it('allows deletion of custom agent', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 2, name: 'custom-agent' });
      // super.delete will be invoked; mock repo for super.delete if needed
      jest.spyOn(Object.getPrototypeOf(AgentRegistryService.prototype), 'delete').mockResolvedValue({ id: 2 } as any);
      const result = await service.delete(2);
      expect(result).toEqual({ id: 2 });
    });
  });

  describe('deleteMany', () => {
    it('aborts batch deletion if any id is the reserved agent', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, name: RESERVED_AGENT_NAME });
      await expect(service.deleteMany([2, 1, 3])).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('rejects renaming reserved agent', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 1,
        name: RESERVED_AGENT_NAME,
        module: { id: 1, name: RESERVED_AGENT_MODULE },
      });
      await expect(
        service.update(1, { name: 'renamed-agent' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects changing reserved agent module', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 1,
        name: RESERVED_AGENT_NAME,
        module: { id: 1, name: RESERVED_AGENT_MODULE },
      });
      await expect(
        service.update(1, { name: RESERVED_AGENT_NAME, moduleUserKey: 'other-module' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects renaming custom agent to reserved name', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 2,
        name: 'custom-agent',
        module: { id: 1, name: RESERVED_AGENT_MODULE },
      });
      await expect(
        service.update(2, { name: RESERVED_AGENT_NAME }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
