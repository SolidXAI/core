import { Injectable } from '@nestjs/common';

import { QueuesModuleOptions } from 'src/interfaces';
import { QueueMessage } from 'src/interfaces/mq';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { PollerService } from 'src/services/poller.service';
import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import { TwilioSMSService } from 'src/services/sms/TwilioSMSService';
import smsQueueOptions from './twilio-sms-queue-options';

@Injectable()
export class TwilioSmsQueueSubscriberRabbitmq extends RabbitMqPublisher<any> {
    constructor(
        private readonly smsService: TwilioSMSService,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...smsQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        return this.smsService.sendSMSSynchronously(message);
    }
}
