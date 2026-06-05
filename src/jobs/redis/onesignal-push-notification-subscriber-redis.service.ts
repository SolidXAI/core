import { Injectable } from "@nestjs/common";
import { PushNotificationFactory } from "src/factories/push-notification.factory";
import { QueueMessage } from "src/interfaces/mq";
import { QueuesModuleOptions } from "src/interfaces";
import { MqMessageQueueService } from "src/services/mq-message-queue.service";
import { MqMessageService } from "src/services/mq-message.service";
import { PollerService } from "src/services/poller.service";
import { OneSignalPushNotificationService } from "src/services/push/onesignal-push-notification.service";
import { RedisSubscriber } from "src/services/queues/redis-subscriber.service";
import queueOptions from "./onesignal-push-notification-queue-options-redis";

@Injectable()
export class OneSignalPushNotificationQueueSubscriberRedis extends RedisSubscriber<any> {
  constructor(
    private readonly pushNotificationFactory: PushNotificationFactory,
    readonly mqMessageService: MqMessageService,
    readonly mqMessageQueueService: MqMessageQueueService,
    readonly poller: PollerService,
  ) {
    super(mqMessageService, mqMessageQueueService);
  }

  options(): QueuesModuleOptions {
    return {
      ...queueOptions,
    };
  }

  subscribe(message: QueueMessage<any>) {
    const pushNotificationService =
      this.pushNotificationFactory.getPushNotificationService(
        OneSignalPushNotificationService.name,
      ) as OneSignalPushNotificationService;

    return pushNotificationService.sendPushNotificationSynchronously(
      message.payload,
    );
  }
}
