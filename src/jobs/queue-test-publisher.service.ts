import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import testQueueConfig from './test-queue.config';
import { MqMessageQueueService } from '../services/mq-message-queue.service';
import { MqMessageService } from '../services/mq-message.service';
import { QueuesModuleOptions } from "../interfaces";


@Injectable()
export class TestQueuePublisher extends RabbitMqPublisher<any> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...testQueueConfig
        }
    }
}
