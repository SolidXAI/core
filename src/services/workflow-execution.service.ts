import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowExecution } from '../entities/workflow-execution.entity';
import { WorkflowExecutionRepository } from '../repository/workflow-execution.repository';

@Injectable()
export class WorkflowExecutionService extends CRUDService<WorkflowExecution>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowExecutionRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'workflowExecution', 'solid-core', moduleRef);
 }
}