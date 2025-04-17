import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty } from 'class-validator';
export class CreateChatterMessageDetailsDto {
@IsOptional()
@IsInt()
@ApiProperty()
chatterMessageId: number;

@IsString()
@IsOptional()
@ApiProperty()
chatterMessageUserKey: string;

@IsOptional()
@IsString()
@ApiProperty()
oldValue: string;

@IsOptional()
@IsString()
@ApiProperty()
newValue: string;

@IsOptional()
@IsString()
@ApiProperty()
oldValueDisplay: string;

@IsOptional()
@IsString()
@ApiProperty()
newValueDisplay: string;

@IsNotEmpty()
@IsString()
@ApiProperty()
fieldName: string;
}