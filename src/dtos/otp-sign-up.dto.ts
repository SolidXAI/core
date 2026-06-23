import {
  IsEmail,
  IsEnum,
  IsJSON,
  IsNotEmpty,
  IsOptional,
} from "class-validator";

import { PasswordlessRegistrationValidateWhatSources } from "../constants";
import { UserDeviceMetadataDto } from "./user-device-metadata.dto";

export class OTPSignUpDto extends UserDeviceMetadataDto {
  @IsNotEmpty()
  username: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsNotEmpty()
  mobile: string;

  @IsOptional()
  @IsEnum(PasswordlessRegistrationValidateWhatSources, { each: true })
  validationSources: PasswordlessRegistrationValidateWhatSources[] = [];

  @IsOptional()
  customPayload: any;
}
