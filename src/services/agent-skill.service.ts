import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from '@solidxai/core';
import { AgentSkill } from '../entities/agent-skill.entity';
import { AgentSkillRepository } from '../repositories/agent-skill.repository';

@Injectable()
export class AgentSkillService extends CRUDService<AgentSkill>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentSkillRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentSkill', 'agent-hub', moduleRef);
 }
}