import { IsString } from 'class-validator';
import { IsOptional, IsBoolean, IsInt } from 'class-validator';
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
    @IsOptional()
    @IsString()
    @ApiProperty()
    type: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    level: string;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "This is the user id field" })
    userId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "This is the user id field" })
    userUserKey: string;
}