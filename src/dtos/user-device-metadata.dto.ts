import { IsEnum, IsOptional, IsString } from "class-validator";

export enum PlatformType {
  Android = "android",
  IOS = "ios",
}

export class UserDeviceMetadataDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  userId?: number;

  @IsString()
  deviceToken?: string;

  @IsString()
  @IsEnum(PlatformType)
  platform?: PlatformType;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  osName?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
