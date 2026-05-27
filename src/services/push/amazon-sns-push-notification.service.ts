import { Injectable, Logger } from "@nestjs/common";
import Handlebars from "handlebars";
import {
  CreatePlatformEndpointCommand,
  GetEndpointAttributesCommand,
  PublishCommandOutput,
  PublishCommand,
  SetEndpointAttributesCommand,
  SNSClient,
} from "@aws-sdk/client-sns";
import { PushNotificationProvider } from "src/decorators/push-notification-provider.decorator";
import {
  IPushNotification,
  RegisterDevicePayload,
  PushNotificationPayload,
  PushNotificationQueuePayload,
} from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { PublisherFactory } from "../queues/publisher-factory.service";
import { SettingService } from "../setting.service";
import type { SolidCoreSetting } from "../settings/default-settings-provider.service";
import { UserDeviceMetadataService } from "../user-device-metadata.service";
import { DeviceMetadataDto } from "src/dtos/device-metadata.dto";
import { PushNotificationTemplateService } from "../push-notification-template.service";

@Injectable()
@PushNotificationProvider()
export class AmazonSNSPushNotificationService implements IPushNotification {
  private readonly logger = new Logger(AmazonSNSPushNotificationService.name);
  private snsClient: SNSClient;

  private getSNSClient(): SNSClient {
    if (!this.snsClient) {
      this.snsClient = new SNSClient({
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

    return this.snsClient;
  }

  constructor(
    private readonly publisherFactory: PublisherFactory<PushNotificationQueuePayload>,
    private readonly settingService: SettingService,
    private readonly userDeviceMetadataService: UserDeviceMetadataService,
    private readonly pushNotificationTemplateService: PushNotificationTemplateService,
  ) {}

  async sendPushNotification(
    endpointArn: string,
    payload: PushNotificationPayload,
    shouldQueuePush = false,
  ): Promise<PublishCommandOutput | string> {
    const message: QueueMessage<PushNotificationQueuePayload> = {
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
    message: QueueMessage<PushNotificationQueuePayload>,
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
    message: PushNotificationQueuePayload,
  ): Promise<PublishCommandOutput> {
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

  async sendPushNotificationUsingTemplate(
    endpointArn: string,
    templateName: string,
    templateParams: any,
    shouldQueuePush = false,
  ): Promise<PublishCommandOutput | string> {
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
    const platformApplicationArn = this.resolvePlatformApplicationArn(platform);
    const existingDevice =
      await this.userDeviceMetadataService.findActiveDevice(userId, deviceId);
    const endpointArn = await this.createOrUpdateEndpoint(
      platformApplicationArn,
      deviceToken,
      existingDevice?.pushEndpointArn,
    );

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
    const device = await this.userDeviceMetadataService.findActiveDevice(
      userId,
      deviceId,
    );

    if (!device) {
      return;
    }

    if (device.pushEndpointArn) {
      try {
        await this.getSNSClient().send(
          new SetEndpointAttributesCommand({
            EndpointArn: device.pushEndpointArn,
            Attributes: {
              Enabled: "false",
            },
          }),
        );
      } catch (error) {
        this.logger.warn(
          `Failed to disable SNS endpoint ${device.pushEndpointArn}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.userDeviceMetadataService.markDeviceInactive(userId, deviceId);
  }

  private async createOrUpdateEndpoint(
    platformApplicationArn: string,
    deviceToken: string,
    existingEndpointArn?: string,
  ): Promise<string> {
    if (existingEndpointArn) {
      await this.getSNSClient().send(
        new SetEndpointAttributesCommand({
          EndpointArn: existingEndpointArn,
          Attributes: {
            Token: deviceToken,
            Enabled: "true",
          },
        }),
      );

      return existingEndpointArn;
    }

    const createResult = await this.getSNSClient().send(
      new CreatePlatformEndpointCommand({
        PlatformApplicationArn: platformApplicationArn,
        Token: deviceToken,
      }),
    );

    const endpointArn = createResult.EndpointArn;
    if (!endpointArn) {
      throw new Error("SNS endpoint ARN was not returned.");
    }

    await this.getSNSClient().send(
      new SetEndpointAttributesCommand({
        EndpointArn: endpointArn,
        Attributes: {
          Token: deviceToken,
          Enabled: "true",
        },
      }),
    );

    await this.getSNSClient().send(
      new GetEndpointAttributesCommand({
        EndpointArn: endpointArn,
      }),
    );

    return endpointArn;
  }

  private resolvePlatformApplicationArn(platform: string): string {
    const normalized = (platform || "").trim().toLowerCase();

    if (normalized === "android") {
      const arn =
        this.settingService.getConfigValue<SolidCoreSetting>(
          "awsFcmPlatformArn",
        );
      if (!arn) {
        throw new Error("Missing setting: awsFcmPlatformArn");
      }
      return arn;
    }

    if (normalized === "ios") {
      const arn =
        this.settingService.getConfigValue<SolidCoreSetting>(
          "awsApnsPlatformArn",
        );
      if (!arn) {
        throw new Error("Missing setting: awsApnsPlatformArn");
      }
      return arn;
    }

    throw new Error(`Unsupported platform: ${platform}`);
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
