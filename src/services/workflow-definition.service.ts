import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { WorkflowDefinitionRepository } from '../repository/workflow-definition.repository';
import { ExecuteWorkflowDto } from '../dtos/execute-workflow.dto';
import { WorkflowRuntimeService } from './workflow/workflow-runtime.service';
import {
  WorkflowDefinitionDsl,
  WorkflowTriggerDefinition,
} from '../types/workflow-dsl.types';
import { WorkflowDefinitionValidatorService } from './workflow/workflow-definition-validator.service';
import { CronExpressionParser } from 'cron-parser';
import YAML from 'yaml';
import { WorkflowDefinitionMetadataSyncService } from './workflow/workflow-definition-metadata-sync.service';

@Injectable()
export class WorkflowDefinitionService extends CRUDService<WorkflowDefinition>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowDefinitionRepository,
    readonly moduleRef: ModuleRef,
    private readonly workflowRuntimeService: WorkflowRuntimeService,
    private readonly workflowDefinitionValidator: WorkflowDefinitionValidatorService,
    private readonly workflowDefinitionMetadataSyncService: WorkflowDefinitionMetadataSyncService,
      
 ) {
   super(entityManager, repo, 'workflowDefinition', 'solid-core', moduleRef);
 }

  async create(createDto: any, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<WorkflowDefinition> {
    const savedDefinition = await super.create(createDto, files, solidRequestContext);
    const populatedDefinition = await this.loadDefinitionWithModule(savedDefinition.id);
    await this.workflowDefinitionMetadataSyncService.upsertWorkflowDefinition(populatedDefinition);
    return savedDefinition;
  }

  async insertMany(createDtos: any[], filesArray: Express.Multer.File[][] = [], solidRequestContext: any = {}): Promise<WorkflowDefinition[]> {
    const savedDefinitions = await super.insertMany(createDtos, filesArray, solidRequestContext);
    for (const savedDefinition of savedDefinitions) {
      const populatedDefinition = await this.loadDefinitionWithModule(savedDefinition.id);
      await this.workflowDefinitionMetadataSyncService.upsertWorkflowDefinition(populatedDefinition);
    }
    return savedDefinitions;
  }

  async update(
    id: number,
    updateDto: any,
    files: Express.Multer.File[] = [],
    isPartialUpdate = false,
    solidRequestContext: any = {},
    isUpdate = false,
  ): Promise<WorkflowDefinition> {
    const previousDefinition = await this.loadDefinitionWithModule(id);
    const savedDefinition = await super.update(id, updateDto, files, isPartialUpdate, solidRequestContext, isUpdate);
    const populatedDefinition = await this.loadDefinitionWithModule(savedDefinition.id);
    await this.workflowDefinitionMetadataSyncService.upsertWorkflowDefinition(
      populatedDefinition,
      previousDefinition,
    );
    return savedDefinition;
  }

  async delete(id: number, solidRequestContext: any = {}) {
    const previousDefinition = await this.loadDefinitionWithModule(id);
    const result = await super.delete(id, solidRequestContext);
    await this.workflowDefinitionMetadataSyncService.removeWorkflowDefinition(previousDefinition);
    return result;
  }

  async deleteMany(ids: number[], solidRequestContext: any = {}): Promise<any> {
    const previousDefinitions = await this.entityManager.find(WorkflowDefinition, {
      where: ids.map((id) => ({ id })) as any,
      relations: ['moduleMetadata'],
    });
    const result = await super.deleteMany(ids, solidRequestContext);
    for (const previousDefinition of previousDefinitions) {
      await this.workflowDefinitionMetadataSyncService.removeWorkflowDefinition(previousDefinition);
    }
    return result;
  }

  async recover(id: number, solidRequestContext: any = {}) {
    const result = await super.recover(id, solidRequestContext);
    const populatedDefinition = await this.loadDefinitionWithModule(id);
    await this.workflowDefinitionMetadataSyncService.upsertWorkflowDefinition(populatedDefinition);
    return result;
  }

  async recoverMany(ids: number[], solidRequestContext: any = {}) {
    const result = await super.recoverMany(ids, solidRequestContext);
    const recoveredDefinitions = await this.entityManager.find(WorkflowDefinition, {
      where: ids.map((id) => ({ id })) as any,
      relations: ['moduleMetadata'],
    });
    for (const recoveredDefinition of recoveredDefinitions) {
      await this.workflowDefinitionMetadataSyncService.upsertWorkflowDefinition(recoveredDefinition);
    }
    return result;
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

  async executeWorkflowWebhook(
    reference: string,
    request: ExecuteWorkflowDto,
  ) {
    const definition = await this.findDefinitionByReference(reference);
    if (!definition) {
      throw new BadRequestException('Workflow definition not found.');
    }

    const dsl = this.parseDefinitionYaml(definition.definitionYaml);
    this.workflowDefinitionValidator.validate(dsl);

    const hasActiveWebhook = (dsl.triggers ?? []).some(
      (trigger) => trigger.type === 'webhook' && !trigger.disabled,
    );
    if (!hasActiveWebhook) {
      throw new BadRequestException(
        'Workflow does not have an active webhook trigger.',
      );
    }

    return this.workflowRuntimeService.executeDefinitionById(definition.id, {
      ...(request ?? {}),
      triggerType: 'webhook',
    });
  }

  async executeDueScheduledTriggers(
    windowStart: Date,
    now = new Date(),
  ): Promise<{ evaluated: number; triggered: number; skipped: number }> {
    const definitions = await this.entityManager.find(WorkflowDefinition, {
      where: { status: 'active' } as any,
    });

    let evaluated = 0;
    let triggered = 0;
    let skipped = 0;

    for (const definition of definitions) {
      const dsl = this.safeParseDefinitionYaml(definition.definitionYaml);
      if (!dsl) {
        skipped += 1;
        continue;
      }

      const triggers = (dsl.triggers ?? []).filter(
        (trigger) => trigger.type === 'schedule' && !trigger.disabled,
      );

      for (const trigger of triggers) {
        evaluated += 1;

        if (!this.isScheduleTriggerDue(trigger, windowStart, now)) {
          skipped += 1;
          continue;
        }

        this.workflowDefinitionValidator.validate(dsl);
        await this.workflowRuntimeService.executeDefinitionById(definition.id, {
          input: this.buildDefaultInputPayload(dsl.inputs ?? {}),
          triggerType: 'schedule',
        });
        triggered += 1;
      }
    }

    return { evaluated, triggered, skipped };
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

  private safeParseDefinitionYaml(definitionYaml: string): WorkflowDefinitionDsl | null {
    try {
      return this.parseDefinitionYaml(definitionYaml);
    } catch {
      return null;
    }
  }

  private async findDefinitionByReference(
    reference: string,
  ): Promise<WorkflowDefinition | null> {
    const trimmedReference = String(reference ?? '').trim();
    if (!trimmedReference) {
      throw new BadRequestException('Workflow reference is required.');
    }

    const numericId = Number(trimmedReference);
    if (Number.isInteger(numericId) && numericId > 0) {
      const byId = await this.entityManager.findOne(WorkflowDefinition, {
        where: { id: numericId } as any,
      });
      if (byId) {
        return byId;
      }
    }

    return this.entityManager.findOne(WorkflowDefinition, {
      where: { key: trimmedReference } as any,
    });
  }

  private async loadDefinitionWithModule(id: number): Promise<WorkflowDefinition> {
    const definition = await this.entityManager.findOne(WorkflowDefinition, {
      where: { id } as any,
      relations: ['moduleMetadata'],
      withDeleted: true,
    });

    if (!definition) {
      throw new BadRequestException(`Workflow definition ${id} not found.`);
    }

    return definition;
  }

  private isScheduleTriggerDue(
    trigger: WorkflowTriggerDefinition,
    windowStart: Date,
    now: Date,
  ): boolean {
    const cronExpression =
      trigger.configuration?.cronExpression ?? trigger.configuration?.cron;
    if (!cronExpression || typeof cronExpression !== 'string') {
      return false;
    }

    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: windowStart,
        tz: trigger.configuration?.timezone ?? 'UTC',
      });
      const nextRun = interval.next().toDate();
      return nextRun.getTime() <= now.getTime();
    } catch {
      return false;
    }
  }

  private buildDefaultInputPayload(inputs: Record<string, any>): Record<string, any> {
    return Object.entries(inputs).reduce<Record<string, any>>((acc, [key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        acc[key] = value.default;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
  }
}
