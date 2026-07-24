import { Injectable } from '@nestjs/common';

import { QueuesModuleOptions } from '../../interfaces';
import { WorkflowExecutionQueuePayload } from '../../types/workflow-execution-queue.types';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { DatabasePublisher } from '../../services/queues/database-publisher.service';
import workflowExecutionQueueOptions from './workflow-execution-queue-options-database';

@Injectable()
export class WorkflowExecutionPublisherDatabase extends DatabasePublisher<WorkflowExecutionQueuePayload> {
  constructor(
    protected readonly mqMessageService: MqMessageService,
    protected readonly mqMessageQueueService: MqMessageQueueService,
  ) {
    super(mqMessageService, mqMessageQueueService);
  }

  options(): QueuesModuleOptions {
    return {
      ...workflowExecutionQueueOptions,
    };
  }
}
