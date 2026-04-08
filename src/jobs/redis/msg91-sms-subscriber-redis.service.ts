import { Injectable } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import smsQueueConfig from './msg91-sms-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { Msg91SMSService } from '../../services/sms/Msg91SMSService';
import { SmsFactory } from 'src/factories/sms.factory';

@Injectable()
export class Msg91SmsQueueSubscriberRedis extends RedisSubscriber<any> {
    constructor(
        private readonly smsFactory: SmsFactory,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...smsQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        const smsService: Msg91SMSService = this.smsFactory.getSmsService(Msg91SMSService.name) as Msg91SMSService;
        return smsService.sendSMSSynchronously(message);
    }
}
