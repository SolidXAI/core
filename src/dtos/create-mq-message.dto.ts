import { Transform } from 'class-transformer';
import { IsInt, IsString, IsNotEmpty, IsDate, IsJSON, IsNumber } from 'class-validator';
import integerTransformer from 'src/transformers/integer-transformer';
export class CreateMqMessageDto {

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
@Transform(integerTransformer)
parentEntityId: number;

@IsNotEmpty()
@IsString()
parentEntity: string;

@IsNotEmpty()
mqMessageQueueId: number;
}