import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { WorkflowDefinitionRepository } from '../repository/workflow-definition.repository';
import { ExecuteWorkflowDto } from '../dtos/execute-workflow.dto';
import { WorkflowRuntimeService } from './workflow/workflow-runtime.service';

@Injectable()
export class WorkflowDefinitionService extends CRUDService<WorkflowDefinition>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowDefinitionRepository,
    readonly moduleRef: ModuleRef,
    private readonly workflowRuntimeService: WorkflowRuntimeService,
      
 ) {
   super(entityManager, repo, 'workflowDefinition', 'solid-core', moduleRef);
 }

  executeWorkflow(id: number, request: ExecuteWorkflowDto) {
    return this.workflowRuntimeService.executeDefinitionById(id, request ?? {});
  }

  executeWorkflowByKey(key: string, request: ExecuteWorkflowDto) {
    return this.workflowRuntimeService.executeDefinitionByKey(key, request ?? {});
  }
}
