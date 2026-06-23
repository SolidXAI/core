import { IsEnum, IsOptional, IsString } from "class-validator";

export enum platformType {
  Android = "android",
  IOS = "ios",
}

export class UserDeviceMetadataDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  userId?: number;

  @IsOptional()
  @IsString()
  deviceToken?: string;

  @IsOptional()
  @IsString()
  @IsEnum(platformType)
  platform?: platformType;

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
