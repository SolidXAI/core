import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentRole } from '../entities/agent-role.entity';
import { AgentRoleRepository } from '../repository/agent-role.repository';

@Injectable()
export class AgentRoleService extends CRUDService<AgentRole>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentRoleRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentRole', 'agent-hub', moduleRef);
 }
}