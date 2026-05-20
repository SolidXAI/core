import { Injectable } from "@nestjs/common";
import { QueuesModuleOptions } from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { AmazonSESService } from "src/services/mail/amazon-ses.service";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { RedisSubscriber } from "src/services/queues/redis-subscriber.service";
import mailQueueOptions from "./amazon-ses-email-queue-options-redis";

@Injectable()
export class AmazonSesEmailQueueSubscriberRedis extends RedisSubscriber<any> {
  constructor(
    private readonly emailService: AmazonSESService,
    readonly mqMessageService: MqMessageService,
    readonly mqMessageQueueService: MqMessageQueueService,
  ) {
    super(mqMessageService, mqMessageQueueService);
  }

  options(): QueuesModuleOptions {
    return {
      ...mailQueueOptions,
    };
  }

  subscribe(message: QueueMessage<any>) {
    return this.emailService.sendEmailSynchronously(message);
  }
}
