import { Injectable } from '@nestjs/common';

import mailQueueOptions from './smtp-email-queue-options-database';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { SMTPEMailService } from 'src/services/mail/smtp-email.service';
import { QueuesModuleOptions } from 'src/interfaces';
import { PollerService } from 'src/services/poller.service';

@Injectable()
export class SmtpEmailQueueSubscriberDatabase extends DatabaseSubscriber<any> {
    constructor(
        private readonly emailService: SMTPEMailService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
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
