import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
  WORKFLOW_NODE_PROVIDER_METADATA,
} from '../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeMetadataResponse,
  WorkflowNodeProviderMetadata,
} from '../../types/workflow-dsl.types';

interface RegisteredWorkflowNodeProvider {
  metadata: WorkflowNodeProviderMetadata;
  handler: WorkflowNodeHandler;
}

@Injectable()
export class WorkflowNodeRegistryService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowNodeRegistryService.name);
  private readonly providers = new Map<string, RegisteredWorkflowNodeProvider>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    for (const provider of this.discoveryService.getProviders()) {
      this.registerProvider(provider);
    }

    this.logger.log(
      `Registered workflow node providers: ${Array.from(
        this.providers.keys(),
      ).join(', ')}`,
    );
  }

  get(type: string): WorkflowNodeHandler {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new BadRequestException(
        `No workflow node provider registered for type "${type}".`,
      );
    }

    return provider.handler;
  }

  list(): WorkflowNodeMetadataResponse[] {
    return Array.from(this.providers.values())
      .map(({ metadata }) => this.toMetadataResponse(metadata))
      .sort((left, right) => {
        const leftCategory = left.category ?? '';
        const rightCategory = right.category ?? '';
        if (leftCategory !== rightCategory) {
          return leftCategory.localeCompare(rightCategory);
        }

        return (left.label ?? left.type).localeCompare(right.label ?? right.type);
      });
  }

  has(type: string): boolean {
    return this.providers.has(type);
  }

  private registerProvider(provider: InstanceWrapper) {
    const metatype = provider.metatype;
    if (!metatype || typeof metatype !== 'function') {
      return;
    }

    const metadata = this.reflector.get<WorkflowNodeProviderMetadata>(
      WORKFLOW_NODE_PROVIDER_METADATA,
      metatype,
    );

    if (!metadata?.type) {
      return;
    }

    const instance = provider.instance as WorkflowNodeHandler | undefined;
    if (!instance || typeof instance.execute !== 'function') {
      this.logger.warn(
        `Workflow node provider "${metadata.type}" has no executable instance.`,
      );
      return;
    }

    if (this.providers.has(metadata.type)) {
      this.logger.warn(
        `Duplicate workflow node provider type "${metadata.type}" ignored.`,
      );
      return;
    }

    this.providers.set(metadata.type, { metadata, handler: instance });
  }

  private toMetadataResponse(
    metadata: WorkflowNodeProviderMetadata,
  ): WorkflowNodeMetadataResponse {
    const resolvedIcon = metadata.ui?.icon ?? metadata.icon;

    return {
      type: metadata.type,
      kind: metadata.kind,
      version: metadata.version,
      category: metadata.category,
      subcategory: metadata.subcategory,
      label: metadata.label,
      description: metadata.description,
      icon: resolvedIcon,
      tags: metadata.tags,
      configSchema: metadata.configSchema,
      uiSchema: metadata.uiSchema,
      outputSchema: metadata.outputSchema,
      examples: metadata.examples,
      metrics: metadata.metrics,
      definitions: metadata.definitions,
      authoring: metadata.authoring,
      runtime: metadata.runtime,
      documentation: metadata.documentation,
      ui: metadata.ui
        ? {
            ...metadata.ui,
            icon: metadata.ui.icon ?? resolvedIcon,
          }
        : resolvedIcon
          ? { icon: resolvedIcon }
          : undefined,
    };
  }
}
