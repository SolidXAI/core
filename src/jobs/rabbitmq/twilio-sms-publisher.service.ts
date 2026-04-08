import { Injectable } from '@nestjs/common';

import { QueuesModuleOptions } from '../../interfaces';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import smsQueueOptions from './twilio-sms-queue-options';

@Injectable()
export class TwilioSmsQueuePublisherRabbitmq extends RabbitMqPublisher<any> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...smsQueueOptions
        }
    }
}
