import { Injectable, Logger } from "@nestjs/common";
import Handlebars from "handlebars";
import { QueueMessage } from "src/interfaces/mq";
import { PushNotificationProvider } from "src/decorators/push-notification-provider.decorator";
import {
  IPushNotification,
  PushNotificationPayload,
  PushNotificationQueuePayload,
  RegisterDevicePayload,
} from "src/interfaces";
import { PublisherFactory } from "../queues/publisher-factory.service";
import { SettingService } from "../setting.service";
import type { SolidCoreSetting } from "../settings/default-settings-provider.service";
import { UserDeviceMetadataService } from "../user-device-metadata.service";
import { PushNotificationTemplateService } from "../push-notification-template.service";
import { initializeApp, getApps, App, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { DeviceMetadataDto } from "src/dtos/device-metadata.dto";

@Injectable()
@PushNotificationProvider()
export class FirebasePushNotificationService implements IPushNotification {
  private readonly logger = new Logger(FirebasePushNotificationService.name);
  private firebaseApp: App;

  constructor(
    private readonly publisherFactory: PublisherFactory<PushNotificationQueuePayload>,
    private readonly settingService: SettingService,
    private readonly userDeviceMetadataService: UserDeviceMetadataService,
    private readonly pushNotificationTemplateService: PushNotificationTemplateService,
  ) {}

  private getFirebaseApp(): App {
    if (this.firebaseApp) {
      return this.firebaseApp;
    }

    const projectId =
      this.settingService.getConfigValue<SolidCoreSetting>("firebaseProjectId");
    const clientEmail = this.settingService.getConfigValue<SolidCoreSetting>(
      "firebaseClientEmail",
    );
    const privateKeyRaw =
      this.settingService.getConfigValue<SolidCoreSetting>(
        "firebasePrivateKey",
      );

    if (!projectId || !clientEmail || !privateKeyRaw) {
      throw new Error(
        "Missing Firebase settings: firebaseProjectId, firebaseClientEmail, firebasePrivateKey",
      );
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    const appName = "solid-core-firebase-push";
    const existing = getApps().find((app) => app.name === appName);
    this.firebaseApp =
      existing ||
      initializeApp(
        {
          credential: cert({ projectId, clientEmail, privateKey }),
          projectId,
        },
        appName,
      );

    return this.firebaseApp;
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
      this.logger.debug(`Queueing Firebase push for endpoint ${endpointArn}`);
      return this.publisherFactory.publish(
        message,
        "FirebasePushNotificationQueuePublisher",
      );
    }

    return this.sendPushNotificationSynchronously(message.payload);
  }

  async sendPushNotificationSynchronously(
    message: PushNotificationQueuePayload,
  ): Promise<any> {
    const deviceToken = this.resolveDeviceToken(message.endpointArn);
    if (!deviceToken) {
      throw new Error("device token is required for Firebase push.");
    }

    const ttlSeconds =
      this.settingService.getConfigValue<SolidCoreSetting>(
        "firebaseDefaultTtl",
      );
    const ttlMs =
      typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds)
        ? Math.max(0, Math.floor(ttlSeconds * 1000))
        : null;
    const useDryRun =
      this.settingService.getConfigValue<SolidCoreSetting>("firebaseUseDryRun");

    const response = await getMessaging(this.getFirebaseApp()).send(
      {
        token: deviceToken,
        notification: {
          title: message.payload.title,
          body: message.payload.body,
        },
        data: message.payload.data ?? {},
        android: ttlMs
          ? { ttl: ttlMs, priority: "high" }
          : { priority: "high" },
        apns: {
          headers: ttlSeconds ? { "apns-expiration": `${ttlSeconds}` } : {},
          payload: { aps: { sound: "default" } },
        },
      },
      Boolean(useDryRun),
    );

    this.logger.debug(`Firebase push sent successfully. MessageId=${response}`);
    return { messageId: response };
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
    if (!deviceToken?.trim()) {
      throw new Error("deviceToken is required.");
    }
    const endpointArn = `fcm:${deviceToken}`;
    await this.userDeviceMetadataService.upsertDeviceForUser({
      userId,
      deviceId,
      deviceToken,
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

  private resolveDeviceToken(endpointOrToken: string): string {
    if (!endpointOrToken) {
      return null;
    }
    if (endpointOrToken.startsWith("fcm:")) {
      return endpointOrToken.slice(4);
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

    // Payload Structure
    // const notificationPayload: PushNotificationPayload = {
    //   title: "SNS Test",
    //   body: "Push working successfully",
    //   data: {
    //     source: "solidx-core-module",
    //     type: "test",
    //   },
    // };

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
      messageId: typeof response === "string" ? response : response?.MessageId,
    };
  }
}
