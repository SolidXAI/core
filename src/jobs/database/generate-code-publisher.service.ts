import { Injectable } from '@nestjs/common';

import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { CodeGenerationOptions, QueuesModuleOptions } from "../../interfaces";
import { DatabasePublisher } from 'src/services/queues/database-publisher.service';
import generateCodeQueueOptions from './generate-code-queue-options';

@Injectable()
export class GenerateCodePublisher extends DatabasePublisher<CodeGenerationOptions> {
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
