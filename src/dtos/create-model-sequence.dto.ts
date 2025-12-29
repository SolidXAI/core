import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateModelSequenceDto {
    @IsOptional()
    @IsInt()
    @ApiProperty()
    moduleId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    moduleUserKey: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    modelId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    modelUserKey: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    fieldId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    fieldUserKey: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    sequenceName: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    currentValue: number;
    @IsOptional()
    @IsString()
    @ApiProperty()
    prefix: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    padding: number;
    @IsOptional()
    @IsString()
    @ApiProperty()
    separator: string;
}