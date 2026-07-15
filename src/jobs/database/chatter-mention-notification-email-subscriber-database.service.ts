import { Injectable } from '@nestjs/common';
import { ChatterMentionNotificationEmailQueueHandler } from 'src/jobs/chatter-mention-notification-email-queue-handler.service';
import { ChatterMentionNotificationPayload } from 'src/interfaces/chatter-mention-notification.interface';
import { QueuesModuleOptions } from 'src/interfaces';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { PollerService } from 'src/services/poller.service';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import queueOptions from './chatter-mention-notification-email-queue-options-database';

@Injectable()
export class ChatterMentionNotificationEmailQueueSubscriberDatabase extends DatabaseSubscriber<ChatterMentionNotificationPayload> {
    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
        private readonly handler: ChatterMentionNotificationEmailQueueHandler,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
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
