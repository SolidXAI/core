import { PartialType } from '@nestjs/swagger';
import { CreateEmailTemplateDto } from './create-email-template.dto';
import { IsString } from 'class-validator';
import { Matches } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsNotEmpty, IsBoolean } from 'class-validator';

export class UpdateEmailTemplateDto extends PartialType(CreateEmailTemplateDto) { 
@IsNotEmpty()
@IsOptional()
@Matches(/[a-z]+(-[a-z]+)*/)
@IsString()
name: string;

@IsNotEmpty()
@IsOptional()
@IsString()
displayName: string;

@IsNotEmpty()
@IsOptional()
@IsString()
body: string;

@IsNotEmpty()
@IsOptional()
@IsString()
subject: string = "{}";

@IsOptional()
@IsString()
description: string;

@IsOptional()
@IsBoolean()
active: boolean = true;

@IsOptional()
@IsString()
emailType: string = "text";

@IsNotEmpty()
@IsOptional()
@IsString()
type: string = "text";
} { }
