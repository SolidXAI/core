import { Injectable } from '@nestjs/common';

import { QueuesModuleOptions } from '../../interfaces';
import { WorkflowExecutionQueuePayload } from '../../types/workflow-execution-queue.types';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { RedisPublisher } from '../../services/queues/redis-publisher.service';
import workflowExecutionQueueOptions from './workflow-execution-queue-options-redis';

@Injectable()
export class WorkflowExecutionPublisherRedis extends RedisPublisher<WorkflowExecutionQueuePayload> {
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
