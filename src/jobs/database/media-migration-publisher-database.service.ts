import { Injectable } from '@nestjs/common';

import mediaMigrationQueueConfig from './media-migration-queue-options-database';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";
import { DatabasePublisher } from 'src/services/queues/database-publisher.service';

/** Queues a media migration job by id. The message only says which job to run. */
@Injectable()
export class MediaMigrationPublisherDatabase extends DatabasePublisher<{ jobId: number }> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...mediaMigrationQueueConfig
        }
    }
}
