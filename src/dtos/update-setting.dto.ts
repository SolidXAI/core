import { IsInt,IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsOptional()
    @IsString()
    @ApiProperty()
    keys: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    values: string;

}