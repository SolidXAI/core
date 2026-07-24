import { Injectable, Logger } from '@nestjs/common';

import { QueueMessage } from '../../interfaces/mq';
import { QueuesModuleOptions } from '../../interfaces';
import { WorkflowExecutionQueuePayload } from '../../types/workflow-execution-queue.types';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { RedisSubscriber } from '../../services/queues/redis-subscriber.service';
import { WorkflowRuntimeService } from '../../services/workflow/workflow-runtime.service';
import workflowExecutionQueueOptions from './workflow-execution-queue-options-redis';

@Injectable()
export class WorkflowExecutionSubscriberRedis extends RedisSubscriber<WorkflowExecutionQueuePayload> {
  private readonly workflowExecutionLogger = new Logger(WorkflowExecutionSubscriberRedis.name);

  constructor(
    readonly mqMessageService: MqMessageService,
    readonly mqMessageQueueService: MqMessageQueueService,
    private readonly workflowRuntimeService: WorkflowRuntimeService,
  ) {
    super(mqMessageService, mqMessageQueueService);
  }

  options(): QueuesModuleOptions {
    return {
      ...workflowExecutionQueueOptions,
    };
  }

  async subscribe(message: QueueMessage<WorkflowExecutionQueuePayload>) {
    const payload = message.payload;
    this.workflowExecutionLogger.log(
      `Processing queued workflow execution message ${message.messageId ?? '<unknown>'}.`,
    );

    if (payload.executionId !== undefined && payload.executionId !== null) {
      return this.workflowRuntimeService.executeEnqueuedExecution(payload.executionId);
    }

    throw new Error('Workflow execution queue payload must include executionId.');
  }
}
