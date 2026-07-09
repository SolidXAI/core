import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowExecutionLog } from '../entities/workflow-execution-log.entity';
import { WorkflowExecutionLogRepository } from '../repository/workflow-execution-log.repository';

@Injectable()
export class WorkflowExecutionLogService extends CRUDService<WorkflowExecutionLog>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowExecutionLogRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'workflowExecutionLog', 'solid-core', moduleRef);
 }
}