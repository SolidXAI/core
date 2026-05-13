import { Injectable } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import whatsappQueueConfig from './msg91-whatsapp-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { Msg91WhatsappService } from '../../services/whatsapp/Msg91WhatsappService';

@Injectable()
export class Msg91WhatsappQueueSubscriberRedis extends RedisSubscriber<any> {
    constructor(
        private readonly whatsappService: Msg91WhatsappService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...whatsappQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        return this.whatsappService.sendWhatsAppMessageSynchronously(message);
    }
}
