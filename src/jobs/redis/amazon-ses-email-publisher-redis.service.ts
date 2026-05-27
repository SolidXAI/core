import { Injectable } from "@nestjs/common";
import { QueuesModuleOptions } from "src/interfaces";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { RedisPublisher } from "src/services/queues/redis-publisher.service";
import mailQueueOptions from "./amazon-ses-email-queue-options-redis";

@Injectable()
export class AmazonSesEmailQueuePublisherRedis extends RedisPublisher<any> {
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
