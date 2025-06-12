import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import whatsappQueueOptions from './whatsapp-queue-options';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";

@Injectable()
export class WhatsappQueuePublisher extends RabbitMqPublisher<any> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...whatsappQueueOptions
        }
    }
}
