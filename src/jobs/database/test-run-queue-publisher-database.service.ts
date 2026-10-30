import { Injectable } from '@nestjs/common';

import testRunQueueConfig from './test-run-queue-options-database';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";
import { DatabasePublisher } from 'src/services/queues/database-publisher.service';
import { TestRunJobPayload } from '../../dtos/test-run-request.dto';

@Injectable()
export class TestRunQueuePublisherDatabase extends DatabasePublisher<TestRunJobPayload> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...testRunQueueConfig
        }
    }
}
