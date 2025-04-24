import { IsString } from 'class-validator';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSettingDto {
    @IsOptional()
    @IsString()
    @ApiProperty()
    key: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    value: string;
}