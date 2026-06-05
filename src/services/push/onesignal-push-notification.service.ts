import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import Handlebars from "handlebars";
import { DeviceMetadataDto } from "src/dtos/device-metadata.dto";
import { PushNotificationProvider } from "src/decorators/push-notification-provider.decorator";
import {
  IPushNotification,
  PushNotificationPayload,
  PushNotificationQueuePayload,
  RegisterDevicePayload,
} from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { PushNotificationTemplateService } from "../push-notification-template.service";
import { PublisherFactory } from "../queues/publisher-factory.service";
import { SettingService } from "../setting.service";
import type { SolidCoreSetting } from "../settings/default-settings-provider.service";
import { UserDeviceMetadataService } from "../user-device-metadata.service";

@Injectable()
@PushNotificationProvider()
export class OneSignalPushNotificationService implements IPushNotification {
  private readonly logger = new Logger(OneSignalPushNotificationService.name);

  constructor(
    private readonly publisherFactory: PublisherFactory<PushNotificationQueuePayload>,
    private readonly settingService: SettingService,
    private readonly userDeviceMetadataService: UserDeviceMetadataService,
    private readonly pushNotificationTemplateService: PushNotificationTemplateService,
  ) {}

  private getHttpClient(): AxiosInstance {
    const apiKey =
      this.settingService.getConfigValue<SolidCoreSetting>("oneSignalApiKey");

    if (!apiKey) {
      throw new Error("Missing OneSignal setting: oneSignalApiKey");
    }

    return axios.create({
      baseURL: "https://api.onesignal.com",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  async sendPushNotification(
    endpointArn: string,
    payload: PushNotificationPayload,
    shouldQueuePush?: boolean,
  ): Promise<any> {
    const message: QueueMessage<PushNotificationQueuePayload> = {
      payload: { endpointArn, payload },
    };

    if (
      shouldQueuePush === true ||
      this.settingService.getConfigValue<SolidCoreSetting>("shouldQueuePush")
    ) {
      this.logger.debug(`Queueing OneSignal push for endpoint ${endpointArn}`);
      return this.publisherFactory.publish(
        message,
        "OneSignalPushNotificationQueuePublisher",
      );
    }

    return this.sendPushNotificationSynchronously(message.payload);
  }

  async sendPushNotificationSynchronously(
    message: PushNotificationQueuePayload,
  ): Promise<any> {
    const subscriptionId = this.resolveSubscriptionId(message.endpointArn);
    if (!subscriptionId) {
      throw new Error("subscription id is required for OneSignal push.");
    }

    const appId =
      this.settingService.getConfigValue<SolidCoreSetting>("oneSignalAppId");
    if (!appId) {
      throw new Error("Missing OneSignal setting: oneSignalAppId");
    }

    try {
      const response = await this.getHttpClient().post(
        "/notifications?c=push",
        {
          app_id: appId,
          target_channel: "push",
          include_subscription_ids: [subscriptionId],
          headings: {
            en: message.payload.title,
          },
          contents: {
            en: message.payload.body,
          },
          data: message.payload.data ?? {},
        },
      );
      const messageId = response.data?.id;
      this.logger.debug(
        `OneSignal push sent to ${subscriptionId} successfully. MessageId=${messageId || "unknown"}`,
      );

      return {
        messageId,
        recipients: response.data?.recipients,
        externalId: response.data?.external_id,
      };
    } catch (error: any) {
      this.logger.error(
        "Failed to send OneSignal push",
        error?.response?.data
          ? JSON.stringify(error.response.data)
          : error?.message,
      );

      throw error;
    }
  }

  async sendPushNotificationUsingTemplate(
    endpointArn: string,
    templateName: string,
    templateParams: any,
    shouldQueuePush?: boolean,
  ): Promise<any> {
    const pushNotificationTemplate =
      await this.pushNotificationTemplateService.findOneByName(templateName);
    if (!pushNotificationTemplate) {
      throw new Error(`Invalid template name ${templateName}`);
    }
    if (pushNotificationTemplate.active === false) {
      throw new Error(`Template '${templateName}' is inactive`);
    }

    const titleTemplate = Handlebars.compile(
      pushNotificationTemplate.title || "",
    );
    const bodyTemplate = Handlebars.compile(
      pushNotificationTemplate.body || "",
    );

    const payload: PushNotificationPayload = {
      title: titleTemplate(templateParams),
      body: bodyTemplate(templateParams),
    };

    if (pushNotificationTemplate.dataTemplate) {
      payload.data = Object.entries(
        pushNotificationTemplate.dataTemplate,
      ).reduce<Record<string, string>>((acc, [key, templateValue]) => {
        const compiled = Handlebars.compile(templateValue || "");
        acc[key] = compiled(templateParams);
        return acc;
      }, {});
    }

    return this.sendPushNotification(endpointArn, payload, shouldQueuePush);
  }

  async registerDevice(payload: RegisterDevicePayload): Promise<string> {
    const { userId, deviceId, deviceToken, platform } = payload;

    const subscriptionId = deviceToken?.trim();

    if (!subscriptionId) {
      throw new Error("deviceToken is required.");
    }

    const endpointArn = `onesignal:${subscriptionId}`;
    await this.userDeviceMetadataService.upsertDeviceForUser({
      userId,
      deviceId,
      deviceToken: subscriptionId,
      platform,
      endpointArn,
      osName: payload.osName,
      osVersion: payload.osVersion,
      appVersion: payload.appVersion,
      deviceName: payload.deviceName,
      deviceType: payload.deviceType,
    });

    return endpointArn;
  }

  async unregisterDevice(userId: number, deviceId: string): Promise<void> {
    await this.userDeviceMetadataService.markDeviceInactive(userId, deviceId);
  }

  private resolveSubscriptionId(endpointOrToken: string): string {
    if (!endpointOrToken) {
      return null;
    }
    if (endpointOrToken.startsWith("onesignal:")) {
      return endpointOrToken.slice("onesignal:".length);
    }
    return endpointOrToken;
  }

  async testPushNotification(dto: DeviceMetadataDto) {
    if (!dto.userId) {
      throw new Error("userId is required");
    }

    const registerPayload: RegisterDevicePayload = {
      userId: dto.userId,
      deviceId: dto.deviceId || "unknown-device",
      deviceToken: dto.deviceToken,
      platform: dto.platform || "unknown",
      deviceName: dto.deviceName || "unknown",
      deviceType: dto.deviceType,
      osName: dto.osName,
      osVersion: dto.osVersion,
      appVersion: dto.appVersion,
    };

    await this.registerDevice(registerPayload);

    const endpointArn =
      await this.userDeviceMetadataService.resolveEndpointArnForUserDevice(
        registerPayload.userId,
        registerPayload.deviceId,
      );

    if (!endpointArn) {
      throw new Error("Unable to resolve endpoint ARN");
    }

    const templateParams = {
      device:
        dto.deviceName ||
        dto.deviceType ||
        `${dto.osName || "Unknown"} ${dto.osVersion || ""}`,
    };

    const response = await this.sendPushNotificationUsingTemplate(
      endpointArn,
      "new-login-detected",
      templateParams,
      false,
    );

    return {
      success: true,
      messageId: response?.messageId,
    };
  }
}
