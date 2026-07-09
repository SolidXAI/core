import { BadRequestException, Injectable } from '@nestjs/common';
import {
  WorkflowDefinitionJson,
  WorkflowNodeDefinition,
} from '../../types/workflow-dsl.types';
import { WorkflowNodeRegistryService } from './workflow-node-registry.service';

@Injectable()
export class WorkflowDefinitionValidatorService {
  constructor(private readonly registry: WorkflowNodeRegistryService) {}

  validate(definition: WorkflowDefinitionJson) {
    if (!definition || !Array.isArray(definition.nodes)) {
      throw new BadRequestException(
        'Workflow definition JSON must include a nodes array.',
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

    if (!node.type) {
      throw new BadRequestException(`Workflow node "${node.id}" requires type.`);
    }

    if (!this.registry.has(node.type)) {
      throw new BadRequestException(
        `Workflow node "${node.id}" uses unregistered type "${node.type}".`,
      );
    }

    this.validateNodes(node.children ?? [], nodeIds);
    this.validateNodes(node.nodes ?? [], nodeIds);
    this.validateNodes(node.then ?? [], nodeIds);
    this.validateNodes(node.else ?? [], nodeIds);

    for (const branch of node.branches ?? []) {
      if (!branch.id) {
        throw new BadRequestException(
          `Workflow node "${node.id}" has a branch without an id.`,
        );
      }
      this.validateNodes(branch.nodes ?? [], nodeIds);
    }
  }
}
