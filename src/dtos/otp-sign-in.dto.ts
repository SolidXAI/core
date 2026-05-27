import { IsEnum, IsNotEmpty, IsOptional } from "class-validator";
import { SignInType } from "./otp-confirm-otp.dto";
import { DeviceMetadataDto } from "./device-metadata.dto";

export class OTPSignInDto extends DeviceMetadataDto {
    @IsEnum(SignInType)
    @IsOptional()
    type?: string;

    @IsNotEmpty()
    identifier: string;
}
