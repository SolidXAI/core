import { Injectable } from "@nestjs/common";
import { UserDeviceMetadata } from "src/entities/user-device-metadata.entity";
import { UserDeviceMetadataRepository } from "src/repository/user-device-metadata.repository";

export interface UpsertUserDeviceInput {
  userId: number;
  deviceId: string;
  deviceToken: string;
  platform: string;
  endpointArn?: string;
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
      existing.pushEndpointArn = payload.endpointArn;
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

    return this.userDeviceMetadataRepository.save(
      this.userDeviceMetadataRepository.create({
        user: { id: payload.userId } as any,
        deviceId: payload.deviceId,
        pushDeviceToken: payload.deviceToken,
        pushEndpointArn: payload.endpointArn,
        platform: payload.platform,
        osName: payload.osName,
        osVersion: payload.osVersion,
        appVersion: payload.appVersion,
        deviceName: payload.deviceName,
        deviceType: payload.deviceType,
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

  async markDeviceInactive(userId: number, deviceId: string): Promise<void> {
    const existing = await this.findActiveDevice(userId, deviceId);

    if (!existing) {
      return;
    }

    existing.isActive = false;
    existing.lastActiveAt = new Date();

    await this.userDeviceMetadataRepository.save(existing);
  }

  async resolveEndpointArnForUserDevice(
    userId: number,
    deviceId: string,
  ): Promise<string | null> {
    const activeDevice = await this.findActiveDevice(userId, deviceId);
    return activeDevice?.pushEndpointArn ?? null;
  }

  async findActiveDevicesByUserId(
    userId: number,
  ): Promise<UserDeviceMetadata[]> {
    return this.userDeviceMetadataRepository.find({
      where: { user: { id: userId }, isActive: true },
    });
  }
}
