import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentProcess } from '../entities/agent-process.entity';
import { AgentProcessRepository } from '../repository/agent-process.repository';
import { AgentHubProcessManagerService } from './agent-hub-process-manager.service';

@Injectable()
export class AgentProcessService extends CRUDService<AgentProcess>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentProcessRepository,
    readonly moduleRef: ModuleRef,
    private readonly processManager: AgentHubProcessManagerService,
      
 ) {
   super(entityManager, repo, 'agentProcess', 'agent-hub', moduleRef);
 }

  async listRuntimeProcesses(authorization: string) {
    return this.processManager.listProcesses(authorization);
  }

  async stopRuntimeProcess(processId: string, authorization: string) {
    return this.processManager.stopProcess(processId, authorization);
  }

  async restartRuntimeProcess(processId: string, authorization: string) {
    const process = await this.entityManager.findOne(AgentProcess, {
      where: { processId },
      relations: { agent: true },
    });
    if (!process?.agent?.id) {
      throw new NotFoundException('The process is not linked to an agent and cannot be restarted.');
    }
    return this.processManager.restartProcess(processId, process.agent.id, authorization);
  }
}
