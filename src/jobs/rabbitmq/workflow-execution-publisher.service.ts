import { Injectable } from '@nestjs/common';

import { QueuesModuleOptions } from '../../interfaces';
import { WorkflowExecutionQueuePayload } from '../../types/workflow-execution-queue.types';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { RabbitMqPublisher } from '../../services/queues/rabbitmq-publisher.service';
import workflowExecutionQueueOptions from './workflow-execution-queue-options';

@Injectable()
export class WorkflowExecutionPublisherRabbitmq extends RabbitMqPublisher<WorkflowExecutionQueuePayload> {
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
