import { Injectable } from "@nestjs/common";
import { QueuesModuleOptions } from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { AmazonSESService } from "src/services/mail/amazon-ses.service";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { PollerService } from "src/services/poller.service";
import { DatabaseSubscriber } from "src/services/queues/database-subscriber.service";
import mailQueueOptions from "./amazon-ses-email-queue-options-database";

@Injectable()
export class AmazonSesEmailQueueSubscriberDatabase extends DatabaseSubscriber<any> {
  constructor(
    private readonly emailService: AmazonSESService,
    readonly mqMessageService: MqMessageService,
    readonly mqMessageQueueService: MqMessageQueueService,
    readonly poller: PollerService,
  ) {
    super(mqMessageService, mqMessageQueueService, poller);
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
