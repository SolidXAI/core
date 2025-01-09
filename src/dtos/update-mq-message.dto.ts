import { PartialType } from '@nestjs/swagger';
import { IsInt,IsOptional, IsString, IsNotEmpty, IsDate, IsJSON } from 'class-validator';
import { CreateMqMessageDto } from './create-mq-message.dto';
export class UpdateMqMessageDto {
    @IsOptional()
    @IsInt()
    id: number;

@IsInt()
retryCount: number;

@IsInt()
retryInterval: number;

@IsString()
messageType: string;

@IsNotEmpty()
@IsString()
stage: string;

@IsDate()
startedAt: Date;

@IsDate()
finishedAt: Date;

@IsInt()
elapsedMillis: number;

@IsJSON()
input: any;

@IsJSON()
output: any;

@IsJSON()
error: any;

@IsNotEmpty()
@IsInt()
parentEntityId: number;

@IsNotEmpty()
@IsString()
parentEntity: string;

@IsNotEmpty()
mqMessageQueueId: number;
}