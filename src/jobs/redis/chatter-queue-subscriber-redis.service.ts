import { Injectable, Logger } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import chatterQueueConfig from './chatter-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { AuditQueuePayload } from '../rabbitmq/chatter-queue-publisher.service';
import { ChatterMessageService } from '../../services/chatter-message.service';

@Injectable()
export class ChatterQueueSubscriberRedis extends RedisSubscriber<any> {
    private readonly chatterQueueLogger = new Logger(ChatterQueueSubscriberRedis.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        private readonly chatterMessageService: ChatterMessageService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...chatterQueueConfig
        }
    }

    async subscribe(message: QueueMessage<AuditQueuePayload>) {
        const p = message.payload;
        this.chatterQueueLogger.debug(`Audit event ${p.eventType} ${p.modelName}#${p.entityId}`);

        switch (p.eventType) {
            case 'insert':
                await this.chatterMessageService.postAuditMessageOnInsert(p.after, { name: p.modelName } as any);
                break;
            case 'update':
                await this.chatterMessageService.postAuditMessageOnUpdate(p.after, { name: p.modelName } as any, p.before, (p.updatedColumnNames || []).map(n => ({ propertyName: n })));
                break;
            case 'delete':
                await this.chatterMessageService.postAuditMessageOnDelete(p.before, { name: p.modelName } as any, p.before);
                break;
        }
    }
}
