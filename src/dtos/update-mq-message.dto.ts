import { PartialType } from '@nestjs/swagger';
import { IsInt,IsOptional, IsString, IsNotEmpty, IsDate, IsJSON } from 'class-validator';
import { CreateMqMessageDto } from './create-mq-message.dto';
export class UpdateMqMessageDto {
    @IsOptional()
    @IsInt()
    id: number;

@IsOptional()    
@IsInt()
retryCount: number;

@IsOptional()
@IsInt()
retryInterval: number;

@IsOptional()
@IsString()
messageType: string;

@IsOptional()
@IsNotEmpty()
@IsString()
stage: string;

@IsOptional()
@IsDate()
startedAt: Date;

@IsOptional()
@IsDate()
finishedAt: Date;

@IsOptional()
@IsInt()
elapsedMillis: number;

@IsOptional()
@IsJSON()
input: any;

@IsOptional()
@IsJSON()
output: any;

@IsOptional()
@IsJSON()
error: any;

@IsOptional()
@IsNotEmpty()
@IsInt()
parentEntityId: number;

@IsOptional()
@IsNotEmpty()
@IsString()
parentEntity: string;

@IsOptional()
@IsNotEmpty()
mqMessageQueueId: number;
}