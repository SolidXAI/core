import { Injectable } from "@nestjs/common";
import { QueueMessage } from "src/interfaces/mq";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { RabbitMqSubscriber } from "src/services/queues/rabbitmq-subscriber.service";
import { QueuesModuleOptions } from "src/interfaces";
import { AmazonSESService } from "src/services/mail/amazon-ses.service";
import mailQueueOptions from "./amazon-ses-email-queue-options";

@Injectable()
export class AmazonSesEmailQueueSubscriberRabbitmq extends RabbitMqSubscriber<any> {
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
