import { Injectable } from '@nestjs/common';

import mailQueueOptions from './api-email-queue-options';
import { RabbitMqSubscriber } from 'src/services/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { ElasticEmailService } from '../services/mail/ElasticEmailService';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";

@Injectable()
export class ApiEmailQueueSubscriber extends RabbitMqSubscriber<any> {
    constructor(
        private readonly emailService: ElasticEmailService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...mailQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        this.emailService.sendEmailSynchronously(message);
    }
}
