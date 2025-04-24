import { IsInt,IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class UpdateChatterMessageDetailsDto {
    @IsOptional()
    @IsInt()
    id: number;

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
@IsOptional()
@IsString()
@ApiProperty()
fieldName: string;
}