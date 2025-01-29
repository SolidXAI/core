import { IsEmail, IsEnum, IsJSON, IsNotEmpty, IsOptional } from 'class-validator';

import { TransactionalRegistrationValidationSource } from "../constants";

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
    @IsEnum(TransactionalRegistrationValidationSource, { each: true })
    validationSources: TransactionalRegistrationValidationSource[] = [];

    @IsOptional()
    customPayload: any;
}