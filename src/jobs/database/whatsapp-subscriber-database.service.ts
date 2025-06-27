import { Injectable } from '@nestjs/common';

import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import whatsappQueueOptions from './whatsapp-queue-options-database';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { Msg91WhatsappService } from 'src/services/whatsapp/Msg91WhatsappService';
import { QueuesModuleOptions } from 'src/interfaces';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';

@Injectable()
export class WhatsappQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        private readonly whatsappService: Msg91WhatsappService,
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
        this.whatsappService.sendSMSSynchronously(message);
    }
}
