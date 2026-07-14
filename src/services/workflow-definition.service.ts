import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { WorkflowDefinitionRepository } from '../repository/workflow-definition.repository';
import { ExecuteWorkflowDto } from '../dtos/execute-workflow.dto';
import { WorkflowRuntimeService } from './workflow/workflow-runtime.service';
import { WorkflowDefinitionDsl } from '../types/workflow-dsl.types';
import { WorkflowDefinitionValidatorService } from './workflow/workflow-definition-validator.service';
import YAML from 'yaml';

@Injectable()
export class WorkflowDefinitionService extends CRUDService<WorkflowDefinition>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowDefinitionRepository,
    readonly moduleRef: ModuleRef,
    private readonly workflowRuntimeService: WorkflowRuntimeService,
    private readonly workflowDefinitionValidator: WorkflowDefinitionValidatorService,
      
 ) {
   super(entityManager, repo, 'workflowDefinition', 'solid-core', moduleRef);
 }

  validateWorkflowDefinition(definitionYaml: string) {
    const definition = this.parseDefinitionYaml(definitionYaml);
    this.workflowDefinitionValidator.validate(definition);
    return {
      valid: true,
      message: 'Workflow definition is valid.',
    };
  }

  executeWorkflow(id: number, request: ExecuteWorkflowDto) {
    return this.workflowRuntimeService.executeDefinitionById(id, request ?? {});
  }

  executeWorkflowByKey(key: string, request: ExecuteWorkflowDto) {
    return this.workflowRuntimeService.executeDefinitionByKey(key, request ?? {});
  }

  private parseDefinitionYaml(definitionYaml: string): WorkflowDefinitionDsl {
    try {
      const parsed = YAML.parse(definitionYaml);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BadRequestException('Workflow definition YAML must resolve to an object.');
      }
      return parsed as WorkflowDefinitionDsl;
    } catch (error: any) {
      throw new BadRequestException(
        error?.message ?? 'Workflow definition YAML could not be parsed.',
      );
    }
  }
}
