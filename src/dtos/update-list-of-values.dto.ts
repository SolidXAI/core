import { IsInt,IsOptional, IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class UpdateListOfValuesDto {
    @IsOptional()
    @IsInt()
    id: number;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
type: string;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
value: string;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
display: string;

@IsNotEmpty()
@IsOptional()
@IsString()
@ApiProperty()
description: string;

@IsOptional()
@IsBoolean()
@ApiProperty()
default: boolean;

@IsOptional()
@IsInt()
@ApiProperty()
sequence: number;
}