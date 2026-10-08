import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { AgentConfigLinkService } from './agent-config-version.service';
import { AgentSkill } from '../entities/agent-skill.entity';
import { AgentSkillRepository } from '../repository/agent-skill.repository';

@Injectable()
export class AgentSkillService extends AgentConfigLinkService<AgentSkill>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentSkillRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentSkill', moduleRef, AgentSkill);
 }
}
