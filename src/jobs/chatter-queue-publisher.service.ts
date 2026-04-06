import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import chatterQueueOptions from './chatter-queue-options';
import { MqMessageQueueService } from '../services/mq-message-queue.service';
import { MqMessageService } from '../services/mq-message.service';
import { QueuesModuleOptions } from "../interfaces";


export type AuditEventType = 'insert' | 'update' | 'delete';

export interface AuditQueuePayload {
    eventType: AuditEventType;
    modelName: string;              // TypeORM entity class name (e.g. 'Order')
    entityId: string | number | null;
    occurredAt: string;             // ISO timestamp, captured at event time
    after?: any;                    // entity state after operation (insert/update)
    before?: any;                   // entity state before operation (update/delete)
    updatedColumnNames?: string[];  // propertyNames of changed columns (update only)
    userId?: string | null;         // active user captured at event time
}

@Injectable()
export class ChatterQueuePublisher extends RabbitMqPublisher<AuditQueuePayload> {
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
