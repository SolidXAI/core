import { Injectable } from "@nestjs/common";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { RabbitMqPublisher } from "src/services/queues/rabbitmq-publisher.service";
import { QueuesModuleOptions } from "src/interfaces";
import mailQueueOptions from "./amazon-ses-email-queue-options";

@Injectable()
export class AmazonSesEmailQueuePublisherRabbitmq extends RabbitMqPublisher<any> {
  constructor(
    protected readonly mqMessageService: MqMessageService,
    protected readonly mqMessageQueueService: MqMessageQueueService,
  ) {
    super(mqMessageService, mqMessageQueueService);
  }

  options(): QueuesModuleOptions {
    return {
      ...mailQueueOptions,
    };
  }
}
