import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { AgentToolRegistryRepository } from '../repositories/agent-tool-registry.repository';

@Injectable()
export class AgentToolRegistryService extends CRUDService<AgentToolRegistry>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentToolRegistryRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentToolRegistry', 'agent-hub', moduleRef);
 }
}