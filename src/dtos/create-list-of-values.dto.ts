import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsBoolean, IsOptional, IsInt } from 'class-validator';

export class CreateListOfValuesDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    type: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    value: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    display: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    description: string;

    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    default: boolean = false;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    sequence: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    moduleId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    moduleUserKey: string;
}