import { Injectable } from '@nestjs/common';

import { RabbitMqPublisher } from 'src/services/queues/rabbitmq-publisher.service';
import { CodeGenerationOptions, QueuesModuleOptions } from "../../interfaces";
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import generateCodeQueueOptions from './generate-code-queue-options';

@Injectable()
export class GenerateCodePublisherRabbitmq extends RabbitMqPublisher<CodeGenerationOptions> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...generateCodeQueueOptions
        }
    }
}
