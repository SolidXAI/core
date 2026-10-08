import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { AgentConfigLinkService } from './agent-config-version.service';
import { AgentRole } from '../entities/agent-role.entity';
import { AgentRoleRepository } from '../repository/agent-role.repository';

@Injectable()
export class AgentRoleService extends AgentConfigLinkService<AgentRole>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentRoleRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentRole', moduleRef, AgentRole);
 }
}
