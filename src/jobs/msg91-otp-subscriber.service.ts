import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import { RabbitMqSubscriber } from 'src/services/queues/rabbitmq-subscriber.service';
import { Msg91OTPService } from '../services/sms/Msg91OTPService';
import otpQueueOptions from './msg91-otp-queue-options';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";
import { SmsFactory } from 'src/factories/sms.factory';

@Injectable()
export class Msg91OTPQueueSubscriber extends RabbitMqSubscriber<any> {
    constructor(
        // private readonly otpService: Msg91OTPService,
        private readonly smsFactory: SmsFactory,

        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...otpQueueOptions
        }
    }

    subscribe(message: QueueMessage<any>) {
        const otpService: Msg91OTPService = this.smsFactory.getSmsService(Msg91OTPService.name) as Msg91OTPService;
        return otpService.sendSMSSynchronously(message);

        // this.otpService.sendSMSSynchronously(message);
    }
}
