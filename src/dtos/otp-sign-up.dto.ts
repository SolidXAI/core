import { IsEmail, IsEnum, IsJSON, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { PasswordlessRegistrationValidateWhatSources } from "../constants";
import { ApiProperty } from '@nestjs/swagger';

export class OTPSignUpDto {
    @IsOptional()
    @IsString()
    @ApiProperty()
    fullName: string;

    @IsNotEmpty()
    @ApiProperty()
    username: string;

    @IsOptional()
    @IsEmail()
    @ApiProperty()
    email: string;

    @IsOptional()
    @IsNotEmpty()
    @ApiProperty()
    mobile: string;

    @IsOptional()
    @IsEnum(PasswordlessRegistrationValidateWhatSources, { each: true })
    validationSources: PasswordlessRegistrationValidateWhatSources[] = [];

    @IsOptional()
    @ApiProperty()
    customPayload: any;
}