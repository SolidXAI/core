import { Injectable } from '@nestjs/common';

import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import whatsappQueueOptions from './three60-whatsapp-queue-options';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { Three60WhatsappService } from 'src/services/whatsapp/Three60WhatsappService';

@Injectable()
export class Three60WhatsappQueueSubscriber extends RabbitMqSubscriber<any> {
    constructor(
        private readonly whatsappService: Three60WhatsappService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...whatsappQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        return this.whatsappService.sendWhatsAppMessageSynchronously(message);
    }
}
