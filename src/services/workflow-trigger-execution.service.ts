import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowTriggerExecution } from '../entities/workflow-trigger-execution.entity';
import { WorkflowTriggerExecutionRepository } from '../repository/workflow-trigger-execution.repository';

@Injectable()
export class WorkflowTriggerExecutionService extends CRUDService<WorkflowTriggerExecution>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowTriggerExecutionRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'workflowTriggerExecution', 'solid-core', moduleRef);
 }
}