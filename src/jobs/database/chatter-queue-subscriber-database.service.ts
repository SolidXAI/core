import { Injectable, Logger } from '@nestjs/common';

import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { PollerService } from 'src/services/poller.service';
import { AuditQueuePayload } from '../chatter-queue-publisher.service';
import { ChatterMessageService } from 'src/services/chatter-message.service';
import chatterQueueOptionsDatabase from './chatter-queue-options-database';

@Injectable()
export class ChatterQueueSubscriberDatabase extends DatabaseSubscriber<AuditQueuePayload> {
    private readonly chatterLogger = new Logger(ChatterQueueSubscriberDatabase.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
        private readonly chatterMessageService: ChatterMessageService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...chatterQueueOptionsDatabase
        };
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
