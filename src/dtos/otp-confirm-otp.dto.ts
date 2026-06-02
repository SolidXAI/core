import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { DeviceMetadataDto } from './device-metadata.dto';

export enum SignInType {
    email = 'email',
    mobile = 'mobile',
}

export class OTPConfirmOTPDto extends DeviceMetadataDto {
    @IsEnum(SignInType)
    @IsNotEmpty()
    type: string;

    @IsNotEmpty()
    identifier: string;

    @IsNotEmpty()
    otp: string;
}
