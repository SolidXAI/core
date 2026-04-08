import { Injectable } from "@nestjs/common";
import { QueuesModuleOptions } from "src/interfaces";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { RabbitMqPublisher } from "src/services/queues/rabbitmq-publisher.service";
import { ComputedFieldEvaluationPayload } from "src/subscribers/computed-entity-field.subscriber";
import computedFieldEvaluationQueueOptions from "./computed-field-evaluation-queue-options";

@Injectable()
export class ComputedFieldEvaluationPublisherRabbitmq extends RabbitMqPublisher<ComputedFieldEvaluationPayload> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...computedFieldEvaluationQueueOptions
        };
    }
}
