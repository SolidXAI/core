import { Injectable } from '@nestjs/common';
import { ChatterMentionNotificationPayload } from 'src/interfaces/chatter-mention-notification.interface';
import { QueuesModuleOptions } from 'src/interfaces';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { RedisPublisher } from 'src/services/queues/redis-publisher.service';
import queueOptions from './chatter-mention-notification-email-queue-options-redis';

@Injectable()
export class ChatterMentionNotificationEmailQueuePublisherRedis extends RedisPublisher<ChatterMentionNotificationPayload> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...queueOptions
        };
    }
}
