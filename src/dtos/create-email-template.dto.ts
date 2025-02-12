import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, MaxLength, MinLength, ValidateNested, Matches, IsString } from 'class-validator';
import { CreateEmailAttachmentDto } from './create-email-attachment.dto';
import { Type } from 'class-transformer';

export class CreateEmailTemplateDto {

@IsNotEmpty()
@Matches(/[a-z]+(-[a-z]+)*/)
@IsString()
name: string;

@IsNotEmpty()
@IsString()
displayName: string;

@IsNotEmpty()
@IsString()
body: string;

@IsNotEmpty()
@IsString()
subject: string;

@IsOptional()
@IsString()
description: string;

@IsOptional()
@IsBoolean()
active: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEmailAttachmentDto)
    attachments: CreateEmailAttachmentDto[];

@IsOptional()
@IsString()
emailType: string = "text";

@IsNotEmpty()
@IsString()
type: string = "text";
}
