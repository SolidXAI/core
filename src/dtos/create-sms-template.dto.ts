import { IsEmail, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateSmsTemplateDto {
    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    displayName: string;

    @IsOptional()
    body: string;

    @IsOptional()
    smsProviderTemplateId: string;

    @IsNotEmpty()
    description: string;

    active: boolean;
}
