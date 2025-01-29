import { IsString } from 'class-validator';
import { IsNotEmpty, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateMqMessageDto } from 'src/dtos/update-mq-message.dto';
export class CreateMqMessageQueueDto {
@IsNotEmpty()
@IsString()
name: string;

@IsOptional()
@IsString()
description: string;

@IsArray()
@ValidateNested({ each : true })
@Type(() => UpdateMqMessageDto)
@IsOptional()
mqMessages: UpdateMqMessageDto[];

@IsOptional()
@IsArray()
mqMessageIds: number[];

@IsOptional()
mqMessageCommand: string;
}