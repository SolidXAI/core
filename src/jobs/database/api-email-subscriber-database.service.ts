import { Injectable } from '@nestjs/common';

import mailQueueOptions from './api-email-queue-options-database';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { ElasticEmailService } from 'src/services/mail/ElasticEmailService';
import { QueuesModuleOptions } from 'src/interfaces';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';

@Injectable()
export class ApiEmailQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        private readonly emailService: ElasticEmailService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...mailQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        this.emailService.sendEmailSynchronously(message);
    }
}
