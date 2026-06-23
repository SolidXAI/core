import { Injectable, Logger } from "@nestjs/common";
import { PushNotificationTarget } from "src/enums/push-notification-target.enum";
import { PushNotificationFactory } from "src/factories/push-notification.factory";
import { PushNotificationPayload, RegisterDevicePayload } from "src/interfaces";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";
import { SettingService } from "src/services/setting.service";
import { UserDeviceMetadata } from "src/entities/user-device-metadata.entity";
import { UserDeviceMetadataService } from "src/services/user-device-metadata.service";

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly pushNotificationFactory: PushNotificationFactory,
    private readonly settingService: SettingService,
    private readonly userDeviceMetadataService: UserDeviceMetadataService,
  ) {}

  async registerDevice(payload: RegisterDevicePayload): Promise<string> {
    const existingDevice =
      await this.userDeviceMetadataService.findActiveDevice(
        payload.userId,
        payload.deviceId,
      );
    const providerRecipientId = await this.pushNotificationFactory
      .getPushNotificationService()
      .registerDevice({
        ...payload,
        providerRecipientId: existingDevice?.pushProviderRecipientId,
      });

    await this.userDeviceMetadataService.upsertDeviceForUser({
      userId: payload.userId,
      deviceId: payload.deviceId,
      deviceToken: payload.deviceToken,
      providerRecipientId,
      platform: payload.platform,
      osName: payload.osName,
      osVersion: payload.osVersion,
      appVersion: payload.appVersion,
      deviceName: payload.deviceName,
      deviceType: payload.deviceType,
    });

    return providerRecipientId;
  }

  async unregisterDevice(userId: number, deviceId: string): Promise<void> {
    const device = await this.userDeviceMetadataService.findActiveDevice(
      userId,
      deviceId,
    );

    if (!device) {
      return;
    }

    if (device.pushProviderRecipientId) {
      await this.pushNotificationFactory
        .getPushNotificationService()
        .unregisterDevice(device.pushProviderRecipientId);
    }

    await this.userDeviceMetadataService.markDeviceInactive(userId, deviceId);
  }

  async sendToUser(
    userId: number,
    payload: PushNotificationPayload,
    shouldQueue?: boolean,
  ): Promise<unknown[]> {
    const targetDevices = (await this.resolveTargetDevices(userId)).filter(
      (device) => device.pushProviderRecipientId,
    );
    const provider = this.pushNotificationFactory.getPushNotificationService();

    return Promise.all(
      targetDevices.map((device) =>
        provider.sendPushNotification(
          device.pushProviderRecipientId,
          payload,
          shouldQueue,
        ),
      ),
    );
  }

  async sendToUsers(
    userIds: number[],
    payload: PushNotificationPayload,
    shouldQueue?: boolean,
  ): Promise<unknown[]> {
    const results = await Promise.all(
      userIds.map((userId) => this.sendToUser(userId, payload, shouldQueue)),
    );

    return results.flat();
  }

  async sendToUserUsingTemplate(
    userId: number,
    templateName: string,
    templateParams: any,
    shouldQueue?: boolean,
  ): Promise<unknown[]> {
    const targetDevices = await this.resolveTargetDevices(userId);
    const provider = this.pushNotificationFactory.getPushNotificationService();

    return Promise.all(
      targetDevices.map((device) =>
        provider.sendPushNotificationUsingTemplate(
          device.pushProviderRecipientId,
          templateName,
          templateParams,
          shouldQueue,
        ),
      ),
    );
  }

  private async resolveTargetDevices(
    userId: number,
  ): Promise<UserDeviceMetadata[]> {
    const devices =
      await this.userDeviceMetadataService.findActiveDevicesByUserId(userId);
    const sendableDevices = devices.filter(
      (device) => device.pushProviderRecipientId && device.isTrusted,
    );

    if (!sendableDevices.length) {
      this.logger.debug(
        `No active push-capable devices found for user ${userId}.`,
      );
      return [];
    }

    switch (this.getPushNotificationTarget()) {
      case PushNotificationTarget.AllDevices:
        return sendableDevices;

      case PushNotificationTarget.PrimaryDevice: {
        const primaryDevices = sendableDevices.filter(
          (device) => device.isPrimary,
        );

        return primaryDevices.length
          ? primaryDevices
          : this.resolveLatestDevice(sendableDevices);
      }

      case PushNotificationTarget.LatestDevice:
      default:
        return this.resolveLatestDevice(sendableDevices);
    }
  }

  private resolveLatestDevice(
    devices: UserDeviceMetadata[],
  ): UserDeviceMetadata[] {
    return [...devices]
      .sort((left, right) => {
        const leftTime = left.lastActiveAt?.getTime() ?? 0;
        const rightTime = right.lastActiveAt?.getTime() ?? 0;
        return rightTime - leftTime;
      })
      .slice(0, 1);
  }

  private getPushNotificationTarget(): PushNotificationTarget {
    const configuredTarget =
      this.settingService.getConfigValue<SolidCoreSetting>(
        "pushNotificationTarget",
      ) ?? PushNotificationTarget.LatestDevice;

    if (
      Object.values(PushNotificationTarget).includes(configuredTarget as any)
    ) {
      return configuredTarget as PushNotificationTarget;
    }

    return PushNotificationTarget.LatestDevice;
  }
}
