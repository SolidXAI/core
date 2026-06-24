import { IsEnum, IsNotEmpty, IsOptional } from "class-validator";
import { SignInType } from "./otp-confirm-otp.dto";
import { UserDeviceMetadataDto } from "./user-device-metadata.dto";

export class OTPSignInDto {
  @IsEnum(SignInType)
  @IsOptional()
  type?: string;

  @IsNotEmpty()
  identifier: string;
}
