import { Injectable } from '@nestjs/common';

import testQueueConfig from './test-queue-db-options';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";
import { DatabasePublisher } from 'src/services/queues/database-publisher.service';


@Injectable()
export class TestQueueDbPublisher extends DatabasePublisher<any> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...testQueueConfig
        }
    }
}
