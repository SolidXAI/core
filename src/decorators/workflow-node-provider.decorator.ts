import { Injectable } from '@nestjs/common';
import { WorkflowNodeProviderMetadata } from '../types/workflow-dsl.types';

export const WORKFLOW_NODE_PROVIDER_METADATA =
  'WORKFLOW_NODE_PROVIDER_METADATA';

export const WorkflowNodeProvider = (
  metadata: WorkflowNodeProviderMetadata,
): ClassDecorator => {
  return (target) => {
    Injectable()(target as any);
    Reflect.defineMetadata(WORKFLOW_NODE_PROVIDER_METADATA, metadata, target);
  };
};
