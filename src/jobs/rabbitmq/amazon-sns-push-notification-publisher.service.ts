import { Injectable } from "@nestjs/common";
import { QueuesModuleOptions } from "src/interfaces";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { RabbitMqPublisher } from "src/services/queues/rabbitmq-publisher.service";
import queueOptions from "./amazon-sns-push-notification-queue-options";

@Injectable()
export class AmazonSnsPushNotificationQueuePublisherRabbitmq extends RabbitMqPublisher<any> {
  constructor(
    protected readonly mqMessageService: MqMessageService,
    protected readonly mqMessageQueueService: MqMessageQueueService,
  ) {
    super(mqMessageService, mqMessageQueueService);
  }

  options(): QueuesModuleOptions {
    return {
      ...queueOptions,
    };
  }
}
