import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import whatsappQueueOptions from './msg91-whatsapp-queue-options-database';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { Msg91WhatsappService } from 'src/services/whatsapp/Msg91WhatsappService';
import { QueuesModuleOptions } from 'src/interfaces';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { PollerService } from 'src/services/poller.service';

@Injectable()
export class Msg91WhatsappQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        private readonly whatsappService: Msg91WhatsappService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...whatsappQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        this.whatsappService.sendWhatsAppMessageSynchronously(message);
    }
}
