import { Injectable } from "@nestjs/common";
import { UserDeviceMetadata } from "src/entities/user-device-metadata.entity";
import { UserDeviceMetadataRepository } from "src/repository/user-device-metadata.repository";

export interface UpsertUserDeviceInput {
  userId: number;
  deviceId: string;
  deviceToken: string;
  platform: string;
  providerRecipientId?: string;
  osName?: string;
  osVersion?: string;
  appVersion?: string;
  deviceType?: string;
  deviceName?: string;
}

@Injectable()
export class UserDeviceMetadataService {
  constructor(
    private readonly userDeviceMetadataRepository: UserDeviceMetadataRepository,
  ) {}

  async upsertDeviceForUser(
    payload: UpsertUserDeviceInput,
  ): Promise<UserDeviceMetadata> {
    const now = new Date();
    const existing = await this.userDeviceMetadataRepository.findOne({
      where: {
        user: { id: payload.userId },
        deviceId: payload.deviceId,
      },
    });

    if (existing) {
      existing.pushDeviceToken = payload.deviceToken;
      existing.platform = payload.platform;
      existing.pushProviderRecipientId = payload.providerRecipientId;
      existing.osName = payload.osName;
      existing.osVersion = payload.osVersion;
      existing.appVersion = payload.appVersion;
      existing.deviceName = payload.deviceName;
      existing.deviceType = payload.deviceType;
      existing.isActive = true;
      existing.lastActiveAt = now;
      existing.pushTokenUpdatedAt = now;
      return this.userDeviceMetadataRepository.save(existing);
    }

    const existingDevices = await this.findActiveDevicesByUserId(
      payload.userId,
    );

    return this.userDeviceMetadataRepository.save(
      this.userDeviceMetadataRepository.create({
        user: { id: payload.userId } as any,
        deviceId: payload.deviceId,
        pushDeviceToken: payload.deviceToken,
        pushProviderRecipientId: payload.providerRecipientId,
        platform: payload.platform,
        osName: payload.osName,
        osVersion: payload.osVersion,
        appVersion: payload.appVersion,
        deviceName: payload.deviceName,
        deviceType: payload.deviceType,
        isPrimary: existingDevices.length === 0,
        isActive: true,
        lastActiveAt: now,
        pushTokenUpdatedAt: now,
      }),
    );
  }

  async findActiveDevice(
    userId: number,
    deviceId: string,
  ): Promise<UserDeviceMetadata | null> {
    return this.userDeviceMetadataRepository.findOne({
      where: { user: { id: userId }, deviceId, isActive: true },
    });
  }

  async resolveProviderRecipientIdForUserDevice(
    userId: number,
    deviceId: string,
  ): Promise<string | null> {
    const activeDevice = await this.findActiveDevice(userId, deviceId);
    return activeDevice?.pushProviderRecipientId ?? null;
  }

  async findActiveDevicesByUserId(
    userId: number,
  ): Promise<UserDeviceMetadata[]> {
    return this.userDeviceMetadataRepository.find({
      where: { user: { id: userId }, isActive: true },
    });
  }

  async markDeviceInactive(userId: number, deviceId: string): Promise<void> {
    const existing = await this.findActiveDevice(userId, deviceId);

    if (!existing) {
      return;
    }

    const wasPrimary = existing.isPrimary;

    existing.isActive = false;
    existing.isPrimary = false;
    existing.lastActiveAt = new Date();

    await this.userDeviceMetadataRepository.save(existing);

    if (wasPrimary) {
      const nextDevice = await this.userDeviceMetadataRepository.findOne({
        where: {
          user: { id: userId },
          isActive: true,
        },
        order: {
          lastActiveAt: "DESC",
        },
      });

      if (nextDevice) {
        nextDevice.isPrimary = true;

        await this.userDeviceMetadataRepository.save(nextDevice);
      }
    }
  }

  async makePrimaryDevice(userId: number, deviceId: string): Promise<void> {
    const device = await this.findActiveDevice(userId, deviceId);

    if (!device) return;

    await this.userDeviceMetadataRepository.update(
      { user: { id: userId } as any },
      { isPrimary: false },
    );

    await this.userDeviceMetadataRepository.update(
      {
        user: { id: userId } as any,
        deviceId,
      },
      {
        isPrimary: true,
        lastActiveAt: new Date(),
      },
    );
  }

  async findPrimaryDevice(userId: number): Promise<UserDeviceMetadata | null> {
    return this.userDeviceMetadataRepository.findOne({
      where: {
        user: { id: userId },
        isPrimary: true,
        isActive: true,
      },
    });
  }

  async findDevicesByUserId(userId: number): Promise<UserDeviceMetadata[]> {
    return this.userDeviceMetadataRepository.find({
      where: {
        user: { id: userId },
      },
      order: {
        lastActiveAt: "DESC",
      },
    });
  }
}
