import { BadRequestException, Injectable } from '@nestjs/common';
import {
  WorkflowDefinitionDsl,
  WorkflowNodeDefinition,
  WorkflowTriggerDefinition,
} from '../../types/workflow-dsl.types';
import { WorkflowNodeRegistryService } from './workflow-node-registry.service';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class WorkflowDefinitionValidatorService {
  constructor(private readonly registry: WorkflowNodeRegistryService) {}

  validate(definition: WorkflowDefinitionDsl) {
    if (!definition || !Array.isArray(definition.nodes)) {
      throw new BadRequestException(
        'Workflow definition YAML must include a nodes array.',
      );
    }

    if (
      definition.triggers !== undefined &&
      definition.triggers !== null &&
      !Array.isArray(definition.triggers)
    ) {
      throw new BadRequestException(
        'Workflow definition triggers must be an array when provided.',
      );
    }

    const nodeIds = new Set<string>();
    this.validateNodes(definition.nodes, nodeIds);
    this.validateNodes(definition.errors ?? [], nodeIds);
    this.validateNodes(definition.finally ?? [], nodeIds);
    this.validateTriggers(definition);
  }

  private validateTriggers(definition: WorkflowDefinitionDsl) {
    const triggers = definition.triggers ?? [];
    const triggerIds = new Set<string>();
    const activeScheduleTriggers = triggers.filter(
      (trigger) => trigger?.type === 'schedule' && !trigger.disabled,
    );

    for (const trigger of triggers) {
      this.validateTrigger(trigger, triggerIds);
    }

    if (!activeScheduleTriggers.length) {
      return;
    }

    const inputs = definition.inputs ?? {};
    for (const [inputKey, inputDefinition] of Object.entries(inputs)) {
      if (!this.inputHasDefault(inputDefinition)) {
        throw new BadRequestException(
          `Workflow input "${inputKey}" requires a default value before enabling a scheduled trigger.`,
        );
      }
    }
  }

  private validateTrigger(
    trigger: WorkflowTriggerDefinition,
    triggerIds: Set<string>,
  ) {
    if (!trigger || typeof trigger !== 'object' || Array.isArray(trigger)) {
      throw new BadRequestException('Every workflow trigger must be an object.');
    }

    if (!trigger.id) {
      throw new BadRequestException('Every workflow trigger requires an id.');
    }

    if (triggerIds.has(trigger.id)) {
      throw new BadRequestException(
        `Duplicate workflow trigger id "${trigger.id}".`,
      );
    }
    triggerIds.add(trigger.id);

    if (!['schedule', 'webhook'].includes(trigger.type)) {
      throw new BadRequestException(
        `Workflow trigger "${trigger.id}" has unsupported type "${trigger.type}".`,
      );
    }

    if (trigger.type === 'schedule') {
      const cronExpression =
        trigger.configuration?.cronExpression ?? trigger.configuration?.cron;
      if (!cronExpression || typeof cronExpression !== 'string') {
        throw new BadRequestException(
          `Workflow trigger "${trigger.id}" requires a cron expression.`,
        );
      }

      try {
        CronExpressionParser.parse(cronExpression, {
          currentDate: new Date(),
          tz: trigger.configuration?.timezone ?? 'UTC',
        });
      } catch (error: any) {
        throw new BadRequestException(
          `Workflow trigger "${trigger.id}" has an invalid cron expression: ${error?.message ?? cronExpression}`,
        );
      }
    }

    if (trigger.type === 'webhook') {
      const method = String(trigger.configuration?.method ?? 'POST').toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        throw new BadRequestException(
          `Workflow trigger "${trigger.id}" has unsupported webhook method "${method}".`,
        );
      }
    }
  }

  private inputHasDefault(inputDefinition: any): boolean {
    if (
      inputDefinition &&
      typeof inputDefinition === 'object' &&
      !Array.isArray(inputDefinition)
    ) {
      return (
        Object.prototype.hasOwnProperty.call(inputDefinition, 'default') &&
        inputDefinition.default !== undefined &&
        inputDefinition.default !== null
      );
    }

    return inputDefinition !== undefined && inputDefinition !== null;
  }

  private validateNodes(nodes: WorkflowNodeDefinition[], nodeIds: Set<string>) {
    for (const node of nodes) {
      this.validateNode(node, nodeIds);
    }
  }

  private validateNode(node: WorkflowNodeDefinition, nodeIds: Set<string>) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new BadRequestException('Every workflow node must be an object.');
    }

    for (const unsupportedKey of ['children', 'branches', 'nodes']) {
      if (Object.prototype.hasOwnProperty.call(node, unsupportedKey)) {
        throw new BadRequestException(
          `Workflow node "${node.id ?? 'unknown'}" uses unsupported child key "${unsupportedKey}". Use "tasks", "then", "else", "defaults", "errors", or "cases" instead.`,
        );
      }
    }

    for (const childKey of ['tasks', 'then', 'else', 'defaults', 'errors'] as const) {
      const childValue = node[childKey];
      if (
        childValue !== undefined &&
        childValue !== null &&
        !Array.isArray(childValue)
      ) {
        throw new BadRequestException(
          `Workflow node "${node.id ?? 'unknown'}" field "${childKey}" must be an array when provided.`,
        );
      }
    }

    if (
      node.cases !== undefined &&
      node.cases !== null &&
      (typeof node.cases !== 'object' || Array.isArray(node.cases))
    ) {
      throw new BadRequestException(
        `Workflow node "${node.id ?? 'unknown'}" field "cases" must be an object of arrays when provided.`,
      );
    }

    if (node.cases && typeof node.cases === 'object') {
      for (const [caseKey, caseNodes] of Object.entries(node.cases)) {
        if (!Array.isArray(caseNodes)) {
          throw new BadRequestException(
            `Workflow node "${node.id ?? 'unknown'}" case "${caseKey}" must be an array.`,
          );
        }
      }
    }

    if (!node.id) {
      throw new BadRequestException('Every workflow node requires an id.');
    }

    if (nodeIds.has(node.id)) {
      throw new BadRequestException(`Duplicate workflow node id "${node.id}".`);
    }

    nodeIds.add(node.id);

    if (!node.kind) {
      throw new BadRequestException(`Workflow node "${node.id}" requires kind.`);
    }

    if (!['task', 'control', 'subflow'].includes(node.kind)) {
      throw new BadRequestException(
        `Workflow node "${node.id}" has unsupported kind "${node.kind}".`,
      );
    }

    if (!node.type) {
      throw new BadRequestException(`Workflow node "${node.id}" requires type.`);
    }

    if (!this.registry.has(node.type)) {
      throw new BadRequestException(
        `Workflow node "${node.id}" uses unregistered type "${node.type}".`,
      );
    }

    this.validateNodes(node.tasks ?? [], nodeIds);
    this.validateNodes(node.then ?? [], nodeIds);
    this.validateNodes(node.else ?? [], nodeIds);
    this.validateNodes(node.defaults ?? [], nodeIds);
    this.validateNodes(node.errors ?? [], nodeIds);
    Object.values(node.cases ?? {}).forEach((caseNodes) => {
      this.validateNodes(caseNodes, nodeIds);
    });
  }
}
