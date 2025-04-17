import { IsInt,IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class UpdateChatterMessageDto {
    @IsOptional()
    @IsInt()
    id: number;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
messageType: string;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
messageSubType: string;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
messageBody: string;

@IsNotEmpty()
@IsOptional()
@IsInt()
@ApiProperty()
coModelEntityId: number;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
coModelName: string;

@IsOptional()
@IsInt()
@ApiProperty()
userId: number;

@IsString()
@IsOptional()
@ApiProperty()
userUserKey: string;
}