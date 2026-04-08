import { Injectable } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import twilioSmsQueueConfig from './twilio-sms-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { TwilioSMSService } from '../../services/sms/TwilioSMSService';
import { SmsFactory } from 'src/factories/sms.factory';
import { PollerService } from '../../services/poller.service';

@Injectable()
export class TwilioSmsQueueSubscriberRedis extends RedisSubscriber<any> {
    constructor(
        private readonly smsFactory: SmsFactory,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...twilioSmsQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        const smsService: TwilioSMSService = this.smsFactory.getSmsService(TwilioSMSService.name) as TwilioSMSService;
        return smsService.sendSMSSynchronously(message);
    }
}
