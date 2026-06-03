import { Injectable } from "@nestjs/common";
import { PushNotificationFactory } from "src/factories/push-notification.factory";
import { QueuesModuleOptions } from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { PollerService } from "src/services/poller.service";
import { FirebasePushNotificationService } from "src/services/push/firebase-push-notification.service";
import { DatabaseSubscriber } from "src/services/queues/database-subscriber.service";
import queueOptions from "./firebase-push-notification-queue-options-database";

@Injectable()
export class FirebasePushNotificationQueueSubscriberDatabase extends DatabaseSubscriber<any> {
  constructor(
    private readonly pushNotificationFactory: PushNotificationFactory,
    readonly mqMessageService: MqMessageService,
    readonly mqMessageQueueService: MqMessageQueueService,
    readonly poller: PollerService,
  ) {
    super(mqMessageService, mqMessageQueueService, poller);
  }

  options(): QueuesModuleOptions {
    return {
      ...queueOptions,
    };
  }

  subscribe(message: QueueMessage<any>) {
    const pushNotificationService =
      this.pushNotificationFactory.getPushNotificationService(
        FirebasePushNotificationService.name,
      ) as FirebasePushNotificationService;

    return pushNotificationService.sendPushNotificationSynchronously(
      message.payload,
    );
  }
}
