import { IsInt,IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsOptional()
    @IsString()
    @ApiProperty()
    key: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    value: string;
}