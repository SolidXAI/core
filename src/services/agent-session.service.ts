import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AgentSession } from 'src/entities/agent-session.entity';
import { AgentSessionRepository } from 'src/repository/agent-session.repository';
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';

@Injectable()
export class AgentSessionService extends CRUDService<AgentSession> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: AgentSessionRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'agentSession', 'solid-core', moduleRef);
  }
}
