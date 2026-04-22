import { Injectable } from "@nestjs/common";
import { QueuesModuleOptions, TriggerMcpClientOptions } from "../../interfaces";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { RabbitMqPublisher } from "src/services/queues/rabbitmq-publisher.service";
import triggerMcpClientQueueOptions from "./trigger-mcp-client-queue-options";

@Injectable()
export class TriggerMcpClientPublisherRabbitmq extends RabbitMqPublisher<TriggerMcpClientOptions> {
    constructor(
        protected readonly mqMessageService: MqMessageService,
        protected readonly mqMessageQueueService: MqMessageQueueService,
    ) {
        super(mqMessageService, mqMessageQueueService);
    }

    options(): QueuesModuleOptions {
        return {
            ...triggerMcpClientQueueOptions
        };
    }
}
