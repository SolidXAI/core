import { Injectable, Logger } from '@nestjs/common';

import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from '../services/mq-message.service';
import { MqMessageQueueService } from '../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
import chatterQueueOptions from './chatter-queue-options';
import { AuditQueuePayload } from './chatter-queue-publisher.service';
import { ChatterMessageService } from 'src/services/chatter-message.service';

@Injectable()
export class ChatterQueueSubscriber extends RabbitMqSubscriber<AuditQueuePayload> {
    private readonly chatterLogger = new Logger(ChatterQueueSubscriber.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        private readonly chatterMessageService: ChatterMessageService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...chatterQueueOptions
        }
    }

    async subscribe(message: QueueMessage<AuditQueuePayload>) {
        const p = message.payload;
        this.chatterLogger.debug(`Audit event ${p.eventType} ${p.modelName}#${p.entityId}`);

        switch (p.eventType) {
            case 'insert':
                await this.chatterMessageService.postAuditMessageOnInsert(p.after, p.modelName);
                break;
            case 'update':
                await this.chatterMessageService.postAuditMessageOnUpdate(
                    p.after,
                    p.modelName,
                    p.before,
                    (p.updatedColumnNames ?? []).map(n => ({ propertyName: n })),
                );
                break;
            case 'delete':
                await this.chatterMessageService.postAuditMessageOnDelete(p.before, p.modelName, p.before);
                break;
        }
    }
}
