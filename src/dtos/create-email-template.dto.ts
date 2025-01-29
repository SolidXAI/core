import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CreateEmailAttachmentDto } from './create-email-attachment.dto';
import { Type } from 'class-transformer';

export class CreateEmailTemplateDto {
    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    displayName: string;

    @IsNotEmpty()
    body: string;

    @IsNotEmpty()
    @MaxLength(128)
    subject: string;

    @IsNotEmpty()
    description: string;

    @IsBoolean()
    active: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEmailAttachmentDto)
    attachments: CreateEmailAttachmentDto[];
}
