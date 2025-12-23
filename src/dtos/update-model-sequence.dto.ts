import { IsInt,IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateModelSequenceDto {
    @IsOptional()
    @IsInt()
    id: number;
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
    @IsOptional()
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