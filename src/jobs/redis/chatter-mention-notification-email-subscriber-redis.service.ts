import { Injectable } from '@nestjs/common';
import { ChatterMentionNotificationEmailQueueHandler } from 'src/jobs/chatter-mention-notification-email-queue-handler.service';
import { ChatterMentionNotificationPayload } from 'src/interfaces/chatter-mention-notification.interface';
import { QueuesModuleOptions } from 'src/interfaces';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import queueOptions from './chatter-mention-notification-email-queue-options-redis';

@Injectable()
export class ChatterMentionNotificationEmailQueueSubscriberRedis extends RedisSubscriber<ChatterMentionNotificationPayload> {
    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        private readonly handler: ChatterMentionNotificationEmailQueueHandler,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...queueOptions
        };
    }

    subscribe(message: QueueMessage<ChatterMentionNotificationPayload>) {
        return this.handler.handle(message);
    }
}
