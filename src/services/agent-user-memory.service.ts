import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentUserMemory } from 'src/entities/agent-user-memory.entity';
import { AgentUserMemoryRepository } from 'src/repository/agent-user-memory.repository';

@Injectable()
export class AgentUserMemoryService extends CRUDService<AgentUserMemory> {
  constructor(
    @InjectEntityManager('default') readonly entityManager: EntityManager,
    readonly repo: AgentUserMemoryRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'agentUserMemory', 'agent-hub', moduleRef);
  }
}
