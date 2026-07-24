import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowStepExecution } from '../entities/workflow-step-execution.entity';
import { WorkflowStepExecutionRepository } from '../repository/workflow-step-execution.repository';

@Injectable()
export class WorkflowStepExecutionService extends CRUDService<WorkflowStepExecution>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowStepExecutionRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'workflowStepExecution', 'solid-core', moduleRef);
 }
}