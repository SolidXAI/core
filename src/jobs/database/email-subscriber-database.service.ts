import { Injectable } from '@nestjs/common';

import mailQueueOptions from './email-queue-options-database';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { SMTPEMailService } from 'src/services/mail/SMTPEmailService';
import { QueuesModuleOptions } from 'src/interfaces';

@Injectable()
export class EmailQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        private readonly emailService: SMTPEMailService,
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
        return this.emailService.sendEmailSynchronously(message);
    }
}
