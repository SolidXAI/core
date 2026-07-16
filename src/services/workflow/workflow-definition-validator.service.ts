import { BadRequestException, Injectable } from '@nestjs/common';
import {
  WorkflowDefinitionDsl,
  WorkflowNodeDefinition,
} from '../../types/workflow-dsl.types';
import { WorkflowNodeRegistryService } from './workflow-node-registry.service';

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
          `Workflow node "${node.id ?? 'unknown'}" uses unsupported child key "${unsupportedKey}". Use "tasks", "then", "else", "defaults", or "cases" instead.`,
        );
      }
    }

    for (const childKey of ['tasks', 'then', 'else', 'defaults'] as const) {
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
    Object.values(node.cases ?? {}).forEach((caseNodes) => {
      this.validateNodes(caseNodes, nodeIds);
    });
  }
}
