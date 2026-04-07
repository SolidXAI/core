import { Injectable } from '@nestjs/common';

import { RedisPublisher } from 'src/services/queues/redis-publisher.service';
import computedFieldEvaluationQueueConfig from './computed-field-evaluation-queue-options-redis';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { MqMessageService } from '../../services/mq-message.service';
import { QueuesModuleOptions } from "../../interfaces";
import { ComputedFieldEvaluationPayload } from 'src/subscribers/computed-entity-field.subscriber';

@Injectable()
export class ComputedFieldEvaluationPublisherRedis extends RedisPublisher<ComputedFieldEvaluationPayload> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...computedFieldEvaluationQueueConfig
        }
    }
}
