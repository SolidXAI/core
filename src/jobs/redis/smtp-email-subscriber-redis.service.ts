import { Injectable } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import smtpEmailQueueConfig from './smtp-email-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { SMTPEMailService } from '../../services/mail/smtp-email.service';

@Injectable()
export class SmtpEmailQueueSubscriberRedis extends RedisSubscriber<any> {
    constructor(
        private readonly emailService: SMTPEMailService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...smtpEmailQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        return this.emailService.sendEmailSynchronously(message);
    }
}
