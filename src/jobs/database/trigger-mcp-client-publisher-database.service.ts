import { Injectable } from "@nestjs/common";
import { QueuesModuleOptions, TriggerMcpClientOptions } from "src/interfaces";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { DatabasePublisher } from "src/services/queues/database-publisher.service";
import triggerMcpClientQueueOptions from "./trigger-mcp-client-queue-options";

@Injectable()
export class TriggerMcpClientPublisherDatabase extends DatabasePublisher<TriggerMcpClientOptions> {
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