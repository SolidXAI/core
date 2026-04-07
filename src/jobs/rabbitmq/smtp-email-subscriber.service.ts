import { Injectable } from '@nestjs/common';

import mailQueueOptions from './smtp-email-queue-options';
import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import { SMTPEMailService } from '../../services/mail/smtp-email.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";

@Injectable()
export class SmtpEmailQueueSubscriberRabbitmq extends RabbitMqSubscriber<any> {
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
