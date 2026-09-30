import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentRegistry } from '../entities/agent-registry.entity';
import { AgentRegistryRepository } from '../repository/agent-registry.repository';

@Injectable()
export class AgentRegistryService extends CRUDService<AgentRegistry>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentRegistryRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentRegistry', 'agent-hub', moduleRef);
 }
}