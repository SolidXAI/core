import { IsEmail, IsEnum, IsJSON, IsNotEmpty, IsOptional } from 'class-validator';

import { PasswordlessRegistrationValidateWhatSources } from "../constants";

export class OTPSignUpDto {
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