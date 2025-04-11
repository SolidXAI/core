import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateSmsTemplateDto } from './create-sms-template.dto';
import { IsString } from 'class-validator';
import { IsOptional, Matches, IsNotEmpty, IsBoolean } from 'class-validator';

export class UpdateSmsTemplateDto extends PartialType(CreateSmsTemplateDto) { 
@IsOptional()
@IsString()
@ApiProperty()
type: string;

@IsNotEmpty()
@IsOptional()
@Matches(/[a-z]+(-[a-z]+)*/)
@IsString()
@ApiProperty()
name: string;

@IsOptional()
@IsString()
@ApiProperty()
smsProviderTemplateId: string;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
displayName: string;

@IsOptional()
@IsString()
@ApiProperty()
body: string;

@IsOptional()
@IsString()
@ApiProperty()
description: string;

@IsOptional()
@IsBoolean()
@ApiProperty()
active: boolean;
} { }
