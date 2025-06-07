import { Injectable, Logger } from '@nestjs/common';

import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import testQueueConfig from './test-queue.config';
import { MqMessageService } from '../services/mq-message.service';
import { MqMessageQueueService } from '../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";

@Injectable()
export class TestQueueSubscriber extends RabbitMqSubscriber<any> {
    private readonly testQueueLogger = new Logger(TestQueueSubscriber.name);
    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...testQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        // console.log(`Received message ${JSON.stringify(message)}`);
        this.testQueueLogger.debug(`Received message: ${JSON.stringify(message)}`);
    }
}
