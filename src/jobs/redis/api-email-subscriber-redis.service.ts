import { Injectable } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import apiEmailQueueConfig from './api-email-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { ElasticEmailService } from '../../services/mail/elastic-email.service';

@Injectable()
export class ApiEmailQueueSubscriberRedis extends RedisSubscriber<any> {
    constructor(
        private readonly emailService: ElasticEmailService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...apiEmailQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        this.emailService.sendEmailSynchronously(message);
    }
}
