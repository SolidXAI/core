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
import { WorkflowNodeProviderMetadata } from '../../types/workflow-dsl.types';

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

  list(): WorkflowNodeProviderMetadata[] {
    return Array.from(this.providers.values()).map(({ metadata }) => metadata);
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
}
