import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsJSON } from 'class-validator';
export class CreateAiInteractionDto {
@IsOptional()
@IsInt()
@ApiProperty()
userId: number;

@IsString()
@IsOptional()
@ApiProperty()
userUserKey: string;

@IsNotEmpty()
@IsString()
@ApiProperty()
threadId: string;

@IsNotEmpty()
@IsString()
@ApiProperty()
role: string;

@IsNotEmpty()
@IsString()
@ApiProperty()
message: string;

@IsOptional()
@IsString()
@ApiProperty()
contentType: string;

@IsOptional()
@IsString()
@ApiProperty()
status: string;

@IsOptional()
@IsString()
@ApiProperty()
errorMessage: string;

@IsOptional()
@IsString()
@ApiProperty()
modelUsed: string;

@IsOptional()
@IsInt()
@ApiProperty()
responseTimeMs: number;

@IsOptional()
@IsJSON()
@ApiProperty()
metadata: any;
}