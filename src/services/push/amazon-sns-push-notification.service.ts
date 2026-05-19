import { Injectable, Logger } from "@nestjs/common";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { PushNotificationProvider } from "src/decorators/push-notification-provider.decorator";
import {
  IPushNotification,
  PushNotificationPayload,
  PushQueuePayload,
} from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { PublisherFactory } from "../queues/publisher-factory.service";
import { SettingService } from "../setting.service";
import type { SolidCoreSetting } from "../settings/default-settings-provider.service";

@Injectable()
@PushNotificationProvider()
export class AmazonSNSPushNotificationService implements IPushNotification {
  private readonly logger = new Logger(AmazonSNSPushNotificationService.name);
  private getSNSClient(): SNSClient {
    return new SNSClient({
      region:
        this.settingService.getConfigValue<SolidCoreSetting>("awsSnsRegion"),
      credentials: {
        accessKeyId:
          this.settingService.getConfigValue<SolidCoreSetting>(
            "awsSnsAccessKeyId",
          ),
        secretAccessKey: this.settingService.getConfigValue<SolidCoreSetting>(
          "awsSnsSecretAccessKey",
        ),
      },
    });
  }

  constructor(
    private readonly publisherFactory: PublisherFactory<PushQueuePayload>,
    private readonly settingService: SettingService,
  ) {}

  async sendPushNotification(
    endpointArn: string,
    payload: PushNotificationPayload,
    shouldQueuePush = false,
  ): Promise<any> {
    const message: QueueMessage<PushQueuePayload> = {
      payload: {
        endpointArn,
        payload,
      },
    };

    if (shouldQueuePush === true) {
      return this.sendPushNotificationAsynchronously(message);
    }

    if (
      shouldQueuePush === false &&
      this.settingService.getConfigValue<SolidCoreSetting>(
        "shouldQueuePush",
      ) === true
    ) {
      return this.sendPushNotificationAsynchronously(message);
    }

    return this.sendPushNotificationSynchronously(message.payload);
  }

  private async sendPushNotificationAsynchronously(
    message: QueueMessage<PushQueuePayload>,
  ): Promise<string> {
    this.logger.debug(
      `Queueing SNS push notification for endpoint ${message.payload.endpointArn}`,
    );

    return this.publisherFactory.publish(
      message,
      "AmazonSnsPushNotificationQueuePublisher",
    );
  }

  async sendPushNotificationSynchronously(
    message: PushQueuePayload,
  ): Promise<any> {
    const { endpointArn, payload } = message;
    if (!endpointArn) {
      throw new Error("endpointArn is required for push notification.");
    }

    const command = new PublishCommand({
      TargetArn: endpointArn,
      Message: JSON.stringify(this.buildPlatformPayload(payload)),
      MessageStructure: "json",
    });

    const response = await this.getSNSClient().send(command);
    this.logger.debug(
      `SNS push notification sent successfully. MessageId=${response.MessageId}`,
    );
    return response;
  }

  private buildPlatformPayload(
    payload: PushNotificationPayload,
  ): Record<string, string> {
    const data = payload.data ?? {};

    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: "default",
      },
      data,
    };

    const gcmPayload = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data,
    };

    return {
      default: payload.body,
      APNS: JSON.stringify(apnsPayload),
      APNS_SANDBOX: JSON.stringify(apnsPayload),
      GCM: JSON.stringify(gcmPayload),
    };
  }
}
