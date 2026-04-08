import { Injectable } from '@nestjs/common';

import { RedisPublisher } from 'src/services/queues/redis-publisher.service';
import generateCodeQueueConfig from './generate-code-queue-options-redis';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { CodeGenerationOptions, QueuesModuleOptions } from "../../interfaces";

@Injectable()
export class GenerateCodePublisherRedis extends RedisPublisher<CodeGenerationOptions> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...generateCodeQueueConfig
        }
    }
}
