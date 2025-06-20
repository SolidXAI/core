import { Injectable } from '@nestjs/common';

import whatsappQueueOptions from './whatsapp-queue-options-database';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from 'src/interfaces';
import { DatabasePublisher } from 'src/services/queues/database-publisher.service';

@Injectable()
export class WhatsappQueuePublisherDatabase extends DatabasePublisher<any> {
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
