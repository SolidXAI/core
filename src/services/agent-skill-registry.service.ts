import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { AgentConfigCatalogService } from './agent-config-version.service';
import { AgentSkill } from '../entities/agent-skill.entity';
import { AgentSkillRegistry } from '../entities/agent-skill-registry.entity';
import { AgentSkillRegistryRepository } from '../repository/agent-skill-registry.repository';

@Injectable()
export class AgentSkillRegistryService extends AgentConfigCatalogService<AgentSkillRegistry>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentSkillRegistryRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentSkillRegistry', moduleRef, AgentSkill, 'agentSkillRegistry');
 }
}
