import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AgentEvent } from 'src/entities/agent-event.entity';
import { AgentEventRepository } from 'src/repository/agent-event.repository';
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';

@Injectable()
export class AgentEventService extends CRUDService<AgentEvent> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: AgentEventRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'agentEvent', 'solid-core', moduleRef);
  }
}
