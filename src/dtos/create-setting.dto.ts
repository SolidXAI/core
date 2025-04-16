import { IsString } from 'class-validator';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSettingDto {
    @IsOptional()
    @IsString()
    @ApiProperty()
    keys: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    values: string;
}