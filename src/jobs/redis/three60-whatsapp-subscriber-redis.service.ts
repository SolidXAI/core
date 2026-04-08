import { Injectable } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import three60WhatsappQueueConfig from './three60-whatsapp-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { Three60WhatsappService } from '../../services/whatsapp/Three60WhatsappService';

@Injectable()
export class Three60WhatsappQueueSubscriberRedis extends RedisSubscriber<any> {
    constructor(
        private readonly whatsappService: Three60WhatsappService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...three60WhatsappQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        this.whatsappService.sendWhatsAppMessageSynchronously(message);
    }
}
