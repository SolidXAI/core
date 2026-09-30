import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgentSkillRegistry } from '../entities/agent-skill-registry.entity';
import { AgentSkillRegistryRepository } from '../repositories/agent-skill-registry.repository';

@Injectable()
export class AgentSkillRegistryService extends CRUDService<AgentSkillRegistry>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentSkillRegistryRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentSkillRegistry', 'agent-hub', moduleRef);
 }
}