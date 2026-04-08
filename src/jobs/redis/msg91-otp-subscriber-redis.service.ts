import { Injectable } from '@nestjs/common';

import { RedisSubscriber } from 'src/services/queues/redis-subscriber.service';
import { QueueMessage } from 'src/interfaces/mq';
import otpQueueConfig from './msg91-otp-queue-options-redis';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { Msg91OTPService } from '../../services/sms/Msg91OTPService';
import { SmsFactory } from 'src/factories/sms.factory';

@Injectable()
export class Msg91OTPQueueSubscriberRedis extends RedisSubscriber<any> {
    constructor(
        private readonly smsFactory: SmsFactory,
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...otpQueueConfig
        }
    }

    subscribe(message: QueueMessage<any>) {
        const otpService: Msg91OTPService = this.smsFactory.getSmsService(Msg91OTPService.name) as Msg91OTPService;
        return otpService.sendSMSSynchronously(message);
    }
}
