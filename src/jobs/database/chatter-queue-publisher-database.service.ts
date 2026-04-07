import { Injectable } from '@nestjs/common';

import { DatabasePublisher } from 'src/services/queues/database-publisher.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";
import { AuditQueuePayload } from '../rabbitmq/chatter-queue-publisher.service';
import chatterQueueOptionsDatabase from './chatter-queue-options-database';

@Injectable()
export class ChatterQueuePublisherDatabase extends DatabasePublisher<AuditQueuePayload> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...chatterQueueOptionsDatabase
        };
    }
}
