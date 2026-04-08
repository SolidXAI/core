import { Injectable } from '@nestjs/common';

import { RedisPublisher } from 'src/services/queues/redis-publisher.service';
import smtpEmailQueueConfig from './smtp-email-queue-options-redis';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";

@Injectable()
export class SmtpEmailQueuePublisherRedis extends RedisPublisher<any> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...smtpEmailQueueConfig
        }
    }
}
