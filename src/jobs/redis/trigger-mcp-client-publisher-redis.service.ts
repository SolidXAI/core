import { Injectable } from '@nestjs/common';

import { RedisPublisher } from 'src/services/queues/redis-publisher.service';
import triggerMcpClientQueueConfig from './trigger-mcp-client-queue-options-redis';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { TriggerMcpClientOptions, QueuesModuleOptions } from "../../interfaces";

@Injectable()
export class TriggerMcpClientPublisherRedis extends RedisPublisher<TriggerMcpClientOptions> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...triggerMcpClientQueueConfig
        }
    }
}
