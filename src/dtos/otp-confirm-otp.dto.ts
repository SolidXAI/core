import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from "class-validator";
import { UserDeviceMetadataDto } from "./user-device-metadata.dto";

export enum SignInType {
  email = "email",
  mobile = "mobile",
}

export class OTPConfirmOTPDto {
  @IsEnum(SignInType)
  @IsNotEmpty()
  type: string;

  @IsNotEmpty()
  identifier: string;

  @IsNotEmpty()
  otp: string;
}
