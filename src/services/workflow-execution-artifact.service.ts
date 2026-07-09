import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowExecutionArtifact } from '../entities/workflow-execution-artifact.entity';
import { WorkflowExecutionArtifactRepository } from '../repository/workflow-execution-artifact.repository';

@Injectable()
export class WorkflowExecutionArtifactService extends CRUDService<WorkflowExecutionArtifact>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowExecutionArtifactRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'workflowExecutionArtifact', 'solid-core', moduleRef);
 }
}