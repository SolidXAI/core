import { Injectable } from '@nestjs/common';

import { QueueMessage } from 'src/interfaces/mq';
import { RabbitMqSubscriber } from 'src/services/rabbitmq-subscriber.service';
import { Msg91OTPService } from '../services/sms/Msg91OTPService';
import otpQueueOptions from './otp-queue-options';
import { MqMessageService } from 'src/services/mq-message.service';
import { MqMessageQueueService } from 'src/services/mq-message-queue.service';
import { QueuesModuleOptions } from "../interfaces";

@Injectable()
export class OTPQueueSubscriber extends RabbitMqSubscriber<any> {
    constructor(
        private readonly otpService: Msg91OTPService,
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
        this.otpService.sendSMSSynchronously(message);
    }
}
