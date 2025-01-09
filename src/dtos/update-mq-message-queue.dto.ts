import { PartialType } from '@nestjs/swagger';
import { IsInt,IsOptional, IsString, IsNotEmpty, ValidateNested, IsArray } from 'class-validator';
import { CreateMqMessageQueueDto } from './create-mq-message-queue.dto';
import { Type } from 'class-transformer';
import { UpdateMqMessageDto } from 'src/dtos/update-mq-message.dto';
export class UpdateMqMessageQueueDto {
    @IsOptional()
    @IsInt()
    id: number;

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