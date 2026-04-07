import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import chatterQueueOptions from './chatter-queue-options';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";


export type ChatterEventType = 'insert' | 'update' | 'delete';

export interface ChatterMessagePayload {
    eventType: ChatterEventType;
    model: string;         // entity name
    entityId: string;      // id string
    occurredAt: string;    // ISO
    before?: any;
    after?: any;
    diff?: string[];       // changed column names for updates
    userId?: string | null;
}

@Injectable()
export class ChatterQueuePublisher extends RabbitMqPublisher<any> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...chatterQueueOptions
        }
    }
}
